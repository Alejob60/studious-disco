const test = require('node:test')
const assert = require('node:assert/strict')

const { analyseSeries, findMissingDays } = require('../shared/series-diagnostics.js')
const { fromCsv, normaliseDate } = require('../shared/evaluate-input.js')

/**
 * The failure these guard against is silent. Feed a retailer's export straight to
 * the model and a fortnight of empty shelves becomes "those days are quiet",
 * the forecast drops, and the WAPE still looks respectable. Nothing throws.
 *
 * So the diagnostics exist to say what is wrong with the data, and the tests are
 * mostly about which cases are high severity and therefore block the claim that
 * the measurement is trustworthy as-is.
 */

const day = (start, n) => {
  const out = []
  const d = new Date(2026, 0, start)
  for (let i = 0; i < n; i += 1) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return out
}

const weekly = (n, base = 100) => Array.from({ length: n }, (_, i) => base + (i % 7) * 8)

test('a clean series reports no findings and is trustworthy', () => {
  const series = weekly(60)
  const report = analyseSeries(series, { dates: day(1, 60) })

  assert.deepEqual(report.findings, [])
  assert.equal(report.reliable, true)
  assert.equal(report.points, 60)
  assert.equal(report.longestZeroRun, 0)
})

test('consecutive zeros are flagged as a possible stock-out, not as quiet days', () => {
  const series = weekly(60)
  series[20] = 0
  series[21] = 0
  series[22] = 0

  const report = analyseSeries(series, { dates: day(1, 60) })
  const finding = report.findings.find((f) => f.code === 'possible_stock_out')

  assert.ok(finding, 'a three-day zero run must be reported')
  assert.equal(finding.severity, 'high')
  // High severity is what flips `reliable`, because this changes what the model
  // learns rather than merely adding noise.
  assert.equal(report.reliable, false)
  assert.equal(report.suspectedStockOutDays, 3)
  assert.equal(report.longestZeroRun, 3)
  // Named by date, not by index: "point 21" means nothing to a store manager.
  assert.ok(finding.when[0].startsWith('2026-01-'))
})

test('a single zero day is not called a stock-out', () => {
  const series = weekly(60)
  series[30] = 0
  const report = analyseSeries(series, { dates: day(1, 60) })

  assert.equal(report.findings.find((f) => f.code === 'possible_stock_out'), undefined)
  assert.equal(report.reliable, true)
})

test('a constant series is high severity: there is nothing to forecast', () => {
  const report = analyseSeries(new Array(40).fill(42), { dates: day(1, 40) })
  const finding = report.findings.find((f) => f.code === 'constant_series')

  assert.ok(finding)
  assert.equal(finding.severity, 'high')
  assert.equal(report.reliable, false)
})

test('missing calendar days are reported when the file carried dates', () => {
  // Sixty observations but the calendar only advances fifty-nine days: a week of
  // data never made it into the export.
  const series = weekly(60)
  const dates = day(1, 60).filter((_, i) => i !== 10 && i !== 11 && i !== 12)

  const report = analyseSeries(series, { dates })
  const finding = report.findings.find((f) => f.code === 'missing_days')

  assert.ok(finding)
  assert.equal(finding.severity, 'medium')
  assert.equal(finding.days, 1)
  // Medium, so it is surfaced but does not make the whole measurement untrusted.
  assert.equal(report.reliable, true)
})

test('without dates there is no gap detection, and nothing is invented', () => {
  const report = analyseSeries(weekly(60))
  assert.equal(report.missingCalendarDays, null)
  assert.equal(report.findings.find((f) => f.code === 'missing_days'), undefined)
})

test('a promotion-sized spike is flagged as an outlier at low severity', () => {
  const series = weekly(60)
  series[35] = 900

  const report = analyseSeries(series, { dates: day(1, 60) })
  const finding = report.findings.find((f) => f.code === 'outliers')

  assert.ok(finding)
  assert.equal(finding.severity, 'low')
  // An outlier is noise the forecast cannot anticipate; it does not invalidate it.
  assert.equal(report.reliable, true)
})

test('a series that is all zeros does not divide by zero', () => {
  const report = analyseSeries(new Array(30).fill(0))
  assert.equal(report.stats.coefficientOfVariation, null)
  assert.doesNotThrow(() => JSON.stringify(report))
})

test('an empty series is reported rather than crashing', () => {
  // `validateLength` rejects an empty series before diagnostics ever run, so this
  // is a dead path in practice — which is exactly why it needs a test. And it is
  // not `reliable`: a series with no observations has nothing to measure.
  const report = analyseSeries([])
  assert.equal(report.points, 0)
  assert.equal(report.reliable, false)
  assert.equal(report.findings.find((f) => f.code === 'constant_series').severity, 'high')
  assert.doesNotThrow(() => JSON.stringify(report))
})

test('findMissingDays ignores unsorted and unparseable input', () => {
  assert.deepEqual(findMissingDays(['2026-01-01', '2026-01-02', '2026-01-03']), [])
  assert.deepEqual(findMissingDays(['2026-01-01', 'oops']), [])
  // Dates going backwards cannot be a gap; reporting 40,000 missing days helps nobody.
  assert.deepEqual(findMissingDays(['2026-01-10', '2026-01-01']), [])
})

test('the CSV parser keeps the dates, and reads the day-first format', () => {
  const csv = ['date,units', '01/02/2026,100', '02/02/2026,110', '03/02/2026,120']
    .concat(weekly(27).map((v, i) => `${String((i + 4) % 28 + 1).padStart(2, '0')}/02/2026,${v}`))
    .join('\n')

  const result = fromCsv(csv)
  assert.equal(result.ok, true)
  assert.equal(result.dates.length, result.series.length)
  // 1 February, not 2 January: misreading a Colombian export month-first would
  // scramble the weekly seasonality the model depends on.
  assert.equal(result.dates[0], '2026-02-01')
  assert.equal(result.dates[1], '2026-02-02')
})

test('an unparseable date costs gap detection but not the series', () => {
  assert.equal(normaliseDate('not a date'), null)
  assert.equal(normaliseDate('2026-02-31'), null)
  assert.equal(normaliseDate('01/02/2026'), '2026-02-01')
  assert.equal(normaliseDate('2026-02-01'), '2026-02-01')
})

test('a headerless file of numbers still parses, with no dates claimed', () => {
  const result = fromCsv(weekly(30).join('\n'))
  assert.equal(result.ok, true)
  assert.equal(result.dates, undefined)
})
