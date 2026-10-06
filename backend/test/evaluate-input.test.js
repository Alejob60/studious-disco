const test = require('node:test')
const assert = require('node:assert/strict')

const { parseSubmission, fromArray, fromCsv, normaliseNumber, MIN_POINTS, MAX_POINTS } = require('../shared/evaluate-input.js')

/**
 * The upload path is the one place a customer's own data enters the model, so
 * these cases are about the ways real files differ from clean arrays: Excel in a
 * Spanish locale, a header the parser has to guess at, and a stray blank line.
 *
 * A misread number here is the dangerous failure. `1.234` becomes 1234 instead of
 * 1.234, the forecast is confidently wrong, and nothing errors.
 */

const seriesOf = (n, value = 100) => Array.from({ length: n }, () => value)

test('a plain array is accepted once it is long enough', () => {
  const result = fromArray(seriesOf(MIN_POINTS))
  assert.equal(result.ok, true)
  assert.equal(result.series.length, MIN_POINTS)
})

test('a series shorter than the holdout is refused with the reason', () => {
  const result = fromArray(seriesOf(MIN_POINTS - 1))
  assert.equal(result.ok, false)
  assert.equal(result.error, 'too_short')
  assert.match(result.detail, new RegExp(`at least ${MIN_POINTS}`))
})

test('an over-long series is refused rather than silently truncated', () => {
  const result = fromArray(seriesOf(MAX_POINTS + 1))
  assert.equal(result.ok, false)
  assert.equal(result.error, 'too_long')
})

test('a non-numeric and a negative value each name the position', () => {
  assert.deepEqual(
    { error: fromArray([...seriesOf(30), 'x']).error, detail: fromArray([...seriesOf(30), 'x']).detail },
    { error: 'not_a_number', detail: 'position 31: "x"' },
  )
  const negative = fromArray([...seriesOf(30), -4])
  assert.equal(negative.error, 'negative_value')
  assert.match(negative.detail, /position 31/)
})

test('numeric strings are coerced, because a CSV cell is always text', () => {
  const result = fromArray([...seriesOf(MIN_POINTS - 1), '120'])
  assert.equal(result.ok, true)
  assert.equal(result.series.at(-1), 120)
})

test('a header row is detected and skipped', () => {
  const csv = ['date,units', ...seriesOf(30).map((v, i) => `2026-01-${String(i + 1).padStart(2, '0')},${v}`)].join('\n')
  const result = fromCsv(csv)
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 30)
})

test('a headerless file of numbers is still a series', () => {
  const csv = seriesOf(30).join('\n')
  const result = fromCsv(csv)
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 30)
})

test('the units column is found by name, so date-first and units-first both work', () => {
  const named = fromCsv(['units,date', ...seriesOf(29).map((v) => `${v},2026-01-01`)].join('\n'))
  assert.equal(named.ok, true)
  assert.equal(named.series.at(-1), 100)
})

test('a Spanish-locale export uses a semicolon and a comma decimal', () => {
  // This is what Excel in Colombia produces, and it is the format most likely to
  // be read as 1234 instead of 1.234.
  const csv = ['fecha;unidades', '2026-01-01;1.234', '2026-01-02;2.500,75', '2026-01-03;3']
    .concat(seriesOf(26).map((v, i) => `2026-01-${String(i + 4).padStart(2, '0')};${v}`))
    .join('\n')

  const result = fromCsv(csv)
  assert.equal(result.ok, true)
  assert.equal(result.series[0], 1234)
  assert.equal(result.series[1], 2500.75)
  assert.equal(result.series[2], 3)
})

test('a dot is a thousands separator when the delimiter is a semicolon', () => {
  assert.equal(normaliseNumber('1.234', ';'), 1234)
  assert.equal(normaliseNumber('1.234,5', ';'), 1234.5)
})

test('a decimal comma is refused when the delimiter is a comma', () => {
  // With a comma delimiter the file cannot also mean a decimal comma, so the
  // ambiguous reading is rejected instead of guessed.
  assert.ok(Number.isNaN(normaliseNumber('1.234,5', ',')))
  assert.ok(Number.isNaN(normaliseNumber('1234,5', ',')))
  assert.equal(normaliseNumber('1.234', ','), 1.234)
})

test('blank lines, comments and Windows line endings are ignored', () => {
  const csv = ['# exported by the POS', 'units', ...seriesOf(28), ''].join('\r\n')
  const result = fromCsv(csv)
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 28)
})

test('a byte-order mark does not hide the units column', () => {
  const csv = '﻿units\n' + seriesOf(28).join('\n')
  const result = fromCsv(csv)
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 28)
})

test('quoted values and a wrong column count fail loudly', () => {
  assert.equal(fromCsv(['units', '"120"'].concat(seriesOf(28)).join('\n')).series[0], 120)
  const wide = fromCsv(['date;units;extra', ...seriesOf(28).map((v) => `x;${v};y`)].join('\n'))
  assert.equal(wide.ok, false)
  assert.equal(wide.error, 'too_many_columns')
})

test('an empty file and a body with no series are told apart', () => {
  assert.equal(fromCsv('   ').error, 'empty_file')
  assert.equal(parseSubmission({}).error, 'no_series')
  assert.equal(parseSubmission(null).error, 'invalid_payload')
})

test('csv wins over an array when both are present', () => {
  const result = parseSubmission({ csv: seriesOf(28).join('\n'), history: seriesOf(99) })
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 28)
})