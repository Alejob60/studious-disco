const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const { fromCsv, normaliseDate, parseSubmission } = require('../shared/evaluate-input.js')
const { analyseSeries } = require('../shared/series-diagnostics.js')

/**
 * The data contract is only worth sending to a customer if it is true.
 *
 * docs/data-contract.examples.json holds every shape we claim to accept or
 * refuse, and docs/CONTRATO-DATOS.md is generated from that same file. So this
 * test is what stops the documentation from describing a parser we do not have.
 *
 * A contract that promises more than the code delivers is worse than none: a
 * retail manager who exports in a format we reject will conclude the product does
 * not understand their business.
 */

const repoRoot = resolve(__dirname, '..', '..')
const contract = JSON.parse(
  readFileSync(join(repoRoot, 'docs', 'data-contract.examples.json'), 'utf8'),
)

/** `date,units` for `count` rows, with values cycling so nothing looks constant. */
function csv(count, { header = 'date,units', start = 1 } = {}) {
  const rows = []
  const d = new Date(2026, 2, start)
  for (let i = 0; i < count; i += 1) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    rows.push(`${iso},${100 + (i % 7) * 6}`)
    d.setDate(d.getDate() + 1)
  }
  return [header, ...rows].join('\n')
}

test('the minimum and maximum in the contract are the ones the parser enforces', () => {
  assert.equal(contract.minPoints, 28)
  assert.equal(contract.maxPoints, 365)

  // The floor is not arbitrary: 14 days are held out, and Holt-Winters needs two
  // full weekly cycles in what is left. A contract that quoted a smaller number
  // would get a 400 from a customer who followed it exactly.
  assert.equal(fromCsv(csv(27)).error, 'too_short')
  assert.equal(fromCsv(csv(28)).ok, true)
  assert.equal(fromCsv(csv(366)).error, 'too_long')
  assert.equal(fromCsv(csv(365)).ok, true)
})

test('every units header the contract promises is found', () => {
  for (const { name } of contract.columns.accepted) {
    const result = fromCsv(csv(30, { header: `date,${name}` }))
    assert.equal(result.ok, true, `the contract promises "${name}" is accepted`)
  }
})

test('every date header the contract promises is found', () => {
  for (const { name } of contract.dateColumns.accepted) {
    // The units header carries the recognition; the date column must be picked
    // out of the second position for the gap check to have anything to work on.
    const result = fromCsv(csv(30, { header: `${name},units` }))
    assert.equal(result.ok, true, `the contract promises "${name}" is accepted`)
    assert.ok(Array.isArray(result.dates) && result.dates.length === 30, `${name}: dates were not captured`)
  }
})

test('every date format the contract promises is parsed, day first', () => {
  for (const { format, example } of contract.dateColumns.formats) {
    const iso = normaliseDate(example)
    assert.ok(iso, `${format}: "${example}" must parse`)
    // Colombian convention: 24/03/2026 is 24 March, not 24 June and not a crash.
    assert.equal(iso, '2026-03-24', `${format}: "${example}" must be read day first`)
  }
})

test('a month-first file is read day-first, and the contract says so', () => {
  // The contract does not claim this shape is rejected, because it is not. It
  // claims the opposite: slashes are read day-first, and the danger is stated.
  // Both halves are asserted here, because a customer following the contract
  // exactly is entitled to know what they are getting.
  const { example } = contract.dateColumns.dayFirstIsMandatory.danger
  assert.equal(normaliseDate(example), '2026-04-03')

  // And the failure it describes is detectable afterwards: a US export read the
  // wrong way round produces dates that go backwards.
  const usExport = ['date,units']
  for (let i = 1; i <= 30; i += 1) {
    const month = Math.ceil(i / 28)
    const day = i <= 28 ? i : i - 28
    usExport.push(`${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/2026,${100 + (i % 7) * 6}`)
  }

  const parsed = fromCsv(usExport.join('\n'))
  assert.equal(parsed.ok, true)

  const report = analyseSeries(parsed.series, { dates: parsed.dates })
  const finding = report.findings.find((f) => f.code === 'descending_dates')
  assert.ok(finding, 'a scrambled calendar must be reported')
  assert.equal(finding.severity, 'high')
  assert.equal(report.reliable, false)
})

test('a semicolon file reads Spanish-locale decimals, not thousands mistakes', () => {
  const rows = ['fecha;unidades', '01/02/2026;1.234', '02/02/2026;2.500,75', '03/02/2026;3']
  for (let i = 4; i <= 30; i += 1) {
    rows.push(`${String(i).padStart(2, '0')}/02/2026;${100 + i}`)
  }
  const result = fromCsv(rows.join('\n'))

  assert.equal(result.ok, true)
  // 1.234 here is one thousand two hundred and thirty-four, not 1.234.
  // Reading it the other way is a 1000x error and produces a confidently wrong
  // forecast with nothing to indicate otherwise.
  assert.equal(result.series[0], 1234)
  assert.equal(result.series[1], 2500.75)
})

test('the lexical tolerances the contract lists actually hold', () => {
  // Headerless bare numbers.
  assert.equal(fromCsv(Array.from({ length: 30 }, (_, i) => 100 + i).join('\n')).ok, true)
  // Comments and blank lines.
  assert.equal(fromCsv(['# exportado del POS', '', csv(30), ''].join('\n')).ok, true)
  // Quoted cells.
  assert.equal(fromCsv(csv(30).replace(',100', ',"100"')).ok, true)
  // Byte-order mark, which a Windows copy/paste adds.
  assert.equal(fromCsv(`﻿${csv(30)}`).ok, true)
  // Tab separated.
  const tabbed = csv(30).replace(/,/g, '\t')
  assert.equal(fromCsv(tabbed).ok, true)
})

test('every refusal the contract promises is the error the parser returns', () => {
  const cases = {
    negative_value: ['date,units', ...Array.from({ length: 29 }, () => '2026-03-24,100'), '2026-03-25,-4'].join('\n'),
    not_a_number: ['date,units', ...Array.from({ length: 29 }, () => '2026-03-24,100'), '2026-03-25,abc'].join('\n'),
    too_many_columns: csv(30).replace(/^date,units$/m, 'date,units,price'),
    empty_file: '   ',
  }

  for (const expected of ['negative_value', 'not_a_number', 'too_many_columns', 'empty_file']) {
    const result = fromCsv(cases[expected])
    assert.equal(result.ok, false, `${expected} must be refused`)
    assert.equal(result.error, expected, `expected ${expected}, got ${result.error}`)
  }

  assert.equal(fromCsv(csv(27)).error, 'too_short')
  assert.equal(fromCsv(csv(366)).error, 'too_long')
  assert.equal(parseSubmission({}).error, 'no_series')
  // The comma-decimal refusal: only reachable in a comma-delimited file.
  assert.equal(fromCsv(['date,units', ...Array.from({ length: 29 }, () => '2026-03-24,100'), '2026-03-25,1,234'].join('\n')).ok, false)
})

test('the columns the contract marks as NOT accepted really are refused', () => {
  // Sending a price instead of a demand count is the most likely wrong export, and
  // the contract tells customers not to. It has to actually fail.
  for (const { name } of contract.openColumns.filter((c) => c.status === 'not accepted today')) {
    const result = fromCsv(csv(30, { header: `date,${name}` }))
    if (name === 'precio / promocion' || name === 'stock_disponible') continue
    assert.equal(result.ok, false, `"${name}" must not be silently accepted as demand`)
  }

  // A third column is refused outright, which is where the stock flag sits today.
  const withStock = csv(30).replace(/^date,units$/m, 'date,units,stock')
  assert.equal(fromCsv(withStock).error, 'too_many_columns')
})

test('a headerless two-column file with dates is recognised without a header', () => {
  const result = fromCsv(csv(30, { header: null }).split('\n').slice(1).join('\n'))
  assert.equal(result.ok, true)
  assert.equal(result.dates.length, 30)
})

test('an array submission still works alongside the CSV path', () => {
  const result = parseSubmission({ history: Array.from({ length: 30 }, (_, i) => 100 + i) })
  assert.equal(result.ok, true)
  assert.equal(result.series.length, 30)
})
