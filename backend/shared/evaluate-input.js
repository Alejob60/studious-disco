'use strict'

/**
 * Turns what a visitor uploads into a validated series.
 *
 * This is the least glamorous part of the product and the part most likely to
 * reject a real customer's file for a reason they cannot see. Two things drive
 * the design:
 *
 *   - A spreadsheet export is not a clean format. Colombian Excel writes `;` as
 *     the delimiter and a comma as the decimal mark; a CSV downloaded from a POS
 *     system or written by a developer uses `,` and `.`. Guessing wrong turns
 *     1.234 into 1234, which produces a confidently wrong forecast, so the
 *     delimiter decides how the decimal mark is read.
 *   - Every rejection has to say which row failed and why. "Invalid input" tells
 *     a retail manager nothing they can act on.
 */

const MIN_POINTS = 28
const MAX_POINTS = 365

/** Header cells that identify the units column, in order of preference. */
const UNITS_HEADER = /^(units?|unidades?|qty|quantity|cantidad|ventas|sales|value|valor|demanda|demand)$/i

/** Header cells that identify the date column. */
const DATE_HEADER = /^(date|fecha|dia|día|day|periodo|period)$/i

/** `YYYY-MM-DD`, which is what we normalise everything to. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Column labels to accept in a submitted array, checked before falling back to position. */
const ARRAY_KEYS = ['history', 'series', 'values', 'data', 'unidades', 'units', 'demanda']

/**
 * Validates a plain array of numbers.
 * Returns `{ ok: true, series }` or `{ ok: false, error, detail }`.
 */
function fromArray(input) {
  if (!Array.isArray(input)) {
    return { ok: false, error: 'history_not_an_array' }
  }

  const series = []
  for (let index = 0; index < input.length; index += 1) {
    const value = Number(input[index])
    if (!Number.isFinite(value)) {
      return { ok: false, error: 'not_a_number', detail: `position ${index + 1}: ${JSON.stringify(input[index])}` }
    }
    if (value < 0) {
      return { ok: false, error: 'negative_value', detail: `position ${index + 1}: ${value}` }
    }
    series.push(value)
  }

  return validateLength(series)
}

/**
 * Parses delimited text into a series.
 *
 * The header is optional: a file that is nothing but numbers is a valid series
 * and is treated as one.
 */
function fromCsv(text) {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, error: 'empty_file' }
  }

  // A byte-order mark survives a copy/paste on Windows and would corrupt the
  // first header cell, hiding the units column.
  const cleaned = text.replace(/^﻿/, '')
  const lines = cleaned
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))

  if (lines.length === 0) return { ok: false, error: 'empty_file' }

  const delimiter = detectDelimiter(lines[0])
  const cells = lines.map((line) => splitLine(line, delimiter))
  const widths = cells.map((row) => row.length)
  const columnCount = widths.reduce((a, b) => (a > b ? a : b))

  if (columnCount > 2) {
    return {
      ok: false,
      error: 'too_many_columns',
      detail: `found ${columnCount} columns; expected a date and a units column`,
    }
  }

  // Units are the last column unless the header names something we recognise,
  // which keeps a two-column file working either way round. The date column is
  // looked for at the same time, because without dates a missing week in the
  // export is indistinguishable from a quiet week.
  let unitsColumn = columnCount - 1
  let dateColumn = -1
  const header = cells[0].map((cell) => cell.trim())
  const named = header.findIndex((cell) => UNITS_HEADER.test(cell.trim()))
  if (named >= 0) unitsColumn = named
  const namedDate = header.findIndex((cell) => DATE_HEADER.test(cell.trim()))
  if (namedDate >= 0) dateColumn = namedDate

  // A headerless two-column file still carries dates, so they are recognised by
  // shape: a leading column that is an ISO date on every row.
  if (dateColumn === -1 && columnCount === 2) {
    const body = cells.filter((row) => row.length >= 2).slice(0, 3)
    if (body.length > 0 && body.every((row) => ISO_DATE.test(String(row[0]).trim()))) {
      dateColumn = 0
    }
  }

  // Drop the header row when it is not itself numeric.
  const start = Number.isFinite(Number(normaliseNumber(header[unitsColumn], delimiter))) ? 0 : 1

  const series = []
  const dates = []
  for (let row = start; row < cells.length; row += 1) {
    const raw = cells[row][unitsColumn]
    if (raw === undefined) {
      return { ok: false, error: 'short_row', detail: `line ${row + 1}: no value in the units column` }
    }

    const value = Number(normaliseNumber(raw, delimiter))
    if (!Number.isFinite(value)) {
      return { ok: false, error: 'not_a_number', detail: `line ${row + 1}: ${JSON.stringify(raw)}` }
    }
    if (value < 0) {
      return { ok: false, error: 'negative_value', detail: `line ${row + 1}: ${value}` }
    }
    series.push(value)

    if (dateColumn >= 0) {
      const iso = normaliseDate(cells[row][dateColumn])
      // A malformed date is not grounds to reject the file: the series is still
      // usable, it only loses gap detection.
      if (iso) dates.push(iso)
    }
  }

  const result = validateLength(series)
  if (!result.ok) return result
  return { ...result, dates: dateColumn >= 0 ? dates : undefined }
}

/**
 * Normalises a date cell to `YYYY-MM-DD`.
 *
 * Accepts the shapes a spreadsheet actually writes. `DD/MM/YYYY` is treated as
 * day-first because every locale that uses slashes does, and misreading a
 * Colombian export month-first would scramble the weekly seasonality the model
 * depends on — the same class of silent error as misreading a decimal mark.
 */
function normaliseDate(raw) {
  const cell = String(raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (ISO_DATE.test(cell)) return isRealDate(cell) ? cell : null

  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(cell)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return isRealDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    : null
}

/**
 * True when the date exists.
 *
 * The ISO pattern alone accepts `2026-02-31`, which `new Date` would then roll
 * forward into March. A gap check over silently rolled dates is worse than none.
 */
function isRealDate(iso) {
  const parsed = parseIso(iso)
  if (!parsed) return false
  return (
    parsed.getFullYear() === Number(iso.slice(0, 4)) &&
    parsed.getMonth() === Number(iso.slice(5, 7)) - 1 &&
    parsed.getDate() === Number(iso.slice(8, 10))
  )
}

function parseIso(iso) {
  const match = ISO_DATE.exec(String(iso ?? ''))
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Normalises one cell to a JavaScript number literal.
 *
 * The delimiter is the signal, and anything ambiguous is refused rather than
 * guessed. Guessing wrong is a silent 1000x error in the data, and a forecast
 * built on it is confidently wrong with nothing to indicate otherwise.
 *
 *   - Semicolon: the file came from a locale that writes `1.234,50`, so the dot
 *     groups thousands and the comma is the decimal mark.
 *   - Comma: the dot is the decimal mark, which leaves no room for a thousands
 *     separator. `1,234` and `1.234` are both refused instead of resolved.
 */
function normaliseNumber(raw, delimiter) {
  const cell = String(raw).trim().replace(/^["']|["']$/g, '').replace(/\s/g, '')
  if (cell === '') return NaN

  if (delimiter === ';') {
    const localised = cell.replace(/\./g, '').replace(',', '.')
    return /^-?\d*\.?\d+$/.test(localised) ? Number(localised) : NaN
  }

  if (cell.includes(',')) return NaN

  return /^-?\d+$/.test(cell) || /^-?\d*\.\d+$/.test(cell) ? Number(cell) : NaN
}

function detectDelimiter(line) {
  const counts = [
    [';', (line.match(/;/g) ?? []).length],
    ['\t', (line.match(/\t/g) ?? []).length],
    [',', (line.match(/,/g) ?? []).length],
  ].sort((a, b) => b[1] - a[1])
  return counts[0][1] > 0 ? counts[0][0] : ','
}

/** Splits one line, honouring double quotes around a value. */
function splitLine(line, delimiter) {
  const out = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      // A doubled quote inside a quoted value is an escaped quote.
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      out.push(current)
      current = ''
    } else {
      current += char
    }
  }
  out.push(current)
  return out
}

function validateLength(series) {
  if (series.length === 0) return { ok: false, error: 'empty_series' }
  if (series.length < MIN_POINTS) {
    return {
      ok: false,
      error: 'too_short',
      detail: `need at least ${MIN_POINTS} days to hold out a forecast and still fit a weekly season; received ${series.length}`,
    }
  }
  if (series.length > MAX_POINTS) {
    return {
      ok: false,
      error: 'too_long',
      detail: `at most ${MAX_POINTS} days are accepted; received ${series.length}`,
    }
  }
  return { ok: true, series }
}

/**
 * Entry point: accepts either a JSON body with an array or a `csv` string.
 */
function parseSubmission(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'invalid_payload' }
  }

  if (typeof payload.csv === 'string') return fromCsv(payload.csv)

  for (const key of ARRAY_KEYS) {
    if (Array.isArray(payload[key])) return fromArray(payload[key])
  }

  // `points` is the fallback for an explicit positional array, so a caller who
  // sends { history: "..." } by mistake is told what was wrong.
  return { ok: false, error: 'no_series', detail: `expected one of: ${ARRAY_KEYS.join(', ')} as an array, or csv as text` }
}

module.exports = {
  parseSubmission,
  fromArray,
  fromCsv,
  normaliseNumber,
  normaliseDate,
  detectDelimiter,
  MIN_POINTS,
  MAX_POINTS,
}