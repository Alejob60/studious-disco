const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildSyntheticHistory,
  buildForecastReport,
  holtWinters,
  seasonalNaive,
  wape,
  mape,
  backtest,
  buildLabels,
  mulberry32,
} = require('../shared/forecast-engine.js')

test('mulberry32 is deterministic and stays in [0, 1)', () => {
  const a = mulberry32(42)
  const b = mulberry32(42)
  for (let i = 0; i < 100; i += 1) {
    const value = a()
    assert.equal(value, b())
    assert.ok(value >= 0 && value < 1)
  }
})

test('synthetic history is reproducible and weekend-peaked', () => {
  const first = buildSyntheticHistory({ days: 90, seed: 7 })
  const second = buildSyntheticHistory({ days: 90, seed: 7 })
  assert.deepEqual(first, second, 'same seed must produce identical history')
  assert.equal(first.length, 90)

  // Average index 5 (Friday) and 6 (Saturday) must exceed index 0 (Sunday).
  const avg = (offsets) =>
    offsets.reduce((sum, offset) => {
      let total = 0
      let count = 0
      for (let i = offset; i < first.length; i += 7) {
        total += first[i]
        count += 1
      }
      return total / count
    }, 0)

  assert.ok(avg([5, 6]) > avg([0]), 'weekend should outsell Sunday')
})

test('holtWinters returns the requested horizon and rejects short series', () => {
  const history = buildSyntheticHistory({ days: 60, seed: 3 })
  const forecast = holtWinters(history, { horizon: 14 })
  assert.equal(forecast.length, 14)
  assert.ok(forecast.every((value) => Number.isFinite(value) && value >= 0))

  assert.throws(() => holtWinters([1, 2, 3], { horizon: 14 }), /at least 14 observations/)
})

test('holtWinters recovers a clean linear trend', () => {
  const series = Array.from({ length: 70 }, (_, i) => 100 + i * 2)
  const forecast = holtWinters(series, { horizon: 7 })
  const expected = 100 + 70 * 2
  // Allow a small tolerance: the trend estimate is not exact at the boundary.
  assert.ok(Math.abs(forecast[0] - expected) < 15, `got ${forecast[0]}, expected ~${expected}`)
})

test('wape and mape return zero for a perfect forecast', () => {
  const series = [10, 20, 30]
  assert.equal(wape(series, series), 0)
  assert.equal(mape(series, series), 0)
})

test('wape handles an all-zero actual series without dividing by zero', () => {
  assert.equal(wape([0, 0, 0], [1, 2, 3]), 0)
})

test('seasonalNaive repeats the previous week', () => {
  const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
  const forecast = seasonalNaive(series, 7)
  assert.deepEqual(forecast, [8, 9, 10, 11, 12, 13, 14])
})

test('the model beats the seasonal-naive baseline on realistic data', () => {
  const history = buildSyntheticHistory({ days: 90, seed: 20260601 })
  const result = backtest(history, { holdout: 14 })

  assert.ok(
    result.modelWape < result.baselineWape,
    `model WAPE ${result.modelWape.toFixed(4)} should beat baseline ${result.baselineWape.toFixed(4)}`,
  )
  assert.ok(result.modelWape < 0.15, `model WAPE ${result.modelWape} should stay under 15%`)
})

test('the report is internally consistent', () => {
  const history = buildSyntheticHistory({ days: 90, seed: 20260601 })
  const report = buildForecastReport(history)

  assert.equal(report.history.length, 90)
  assert.equal(report.forecast.length, 14)
  assert.equal(report.model, 'holt-winters-additive')
  assert.equal(report.period, 7)

  // Week-ahead KPI must equal the sum of the first 7 forecast points.
  const sum = report.forecast.slice(0, 7).reduce((total, point) => total + point.value, 0)
  assert.ok(Math.abs(sum - report.kpis.weekAheadUnits) <= 7, 'rounding tolerance')

  // The peak KPI must actually be the maximum of the window.
  const max = Math.max(...report.forecast.slice(0, 14).map((point) => point.value))
  assert.equal(report.kpis.peakUnits, max)

  // Confidence bands must bracket the point forecast.
  for (const point of report.forecast) {
    assert.ok(point.lower <= point.value && point.value <= point.upper)
    assert.ok(point.lower >= 0)
  }

  // Forecast must start the day after history ends — no gap, no overlap.
  const lastHistory = new Date(`${report.history.at(-1).date}T00:00:00`)
  lastHistory.setDate(lastHistory.getDate() + 1)
  const expectedNextDay = `${lastHistory.getFullYear()}-${String(lastHistory.getMonth() + 1).padStart(2, '0')}-${String(lastHistory.getDate()).padStart(2, '0')}`
  assert.equal(report.forecast[0].date, expectedNextDay)

  // The forecast window must be 14 strictly consecutive days.
  const toUtc = (iso) => new Date(`${iso}T00:00:00Z`).getTime()
  for (let i = 1; i < report.forecast.length; i += 1) {
    const diffDays = (toUtc(report.forecast[i].date) - toUtc(report.forecast[i - 1].date)) / 86400000
    assert.equal(diffDays, 1, `forecast gap between index ${i - 1} and ${i}`)
  }
})

test('buildLabels advances one calendar day at a time', () => {
  const end = new Date(2026, 5, 14) // 14 June 2026, local time
  const labels = buildLabels(4, end)
  assert.equal(labels.length, 4)
  assert.equal(labels.at(-1).date, '2026-06-14')
  assert.equal(labels[0].date, '2026-06-11')
  assert.deepEqual(labels.map((entry) => entry.label), ['Jue 11', 'Vie 12', 'Sáb 13', 'Dom 14'])
})