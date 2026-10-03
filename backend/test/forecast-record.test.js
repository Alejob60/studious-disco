const test = require('node:test')
const assert = require('node:assert/strict')
const {
  buildForecastRecord,
  hashSeries,
  isPublishable,
  validateChallengerResult,
} = require('../shared/forecast-record.js')

const NOW = Date.parse('2026-10-03T12:00:00Z')

function freshForecast(overrides = {}) {
  return {
    version: 1,
    engine: 'timesfm-2.5',
    model: 'google/timesfm-2.5-200m-pytorch',
    generatedAt: new Date(NOW - 60_000).toISOString(),
    horizon: 14,
    historyHash: 'abc123',
    latencyMs: 1900,
    band: 'p10-p90',
    forecast: [{ offsetDays: 1, date: '2026-10-04', value: 230, lower: 214, upper: 248 }],
    ...overrides,
  }
}

test('a fresh forecast is publishable', () => {
  assert.equal(isPublishable(freshForecast(), { now: NOW }), true)
})

test('a stale forecast is refused so the champion takes over', () => {
  const old = freshForecast({ generatedAt: new Date(NOW - 48 * 3600_000).toISOString() })
  assert.equal(isPublishable(old, { now: NOW }), false)
})

test('malformed records are refused rather than served', () => {
  for (const bad of [null, undefined, 'string', 42, {}, { forecast: [] }, { forecast: [1] }]) {
    assert.equal(isPublishable(bad, { now: NOW }), false, `${JSON.stringify(bad)} must be refused`)
  }
})

test('an unparseable timestamp is refused', () => {
  assert.equal(isPublishable(freshForecast({ generatedAt: 'ayer' }), { now: NOW }), false)
})

test('a timestamp far in the future is refused as clock skew', () => {
  const ahead = freshForecast({ generatedAt: new Date(NOW + 3600_000).toISOString() })
  assert.equal(isPublishable(ahead, { now: NOW }), false)
})

test('the age limit is configurable', () => {
  const twoHours = freshForecast({ generatedAt: new Date(NOW - 2 * 3600_000).toISOString() })
  assert.equal(isPublishable(twoHours, { now: NOW, maxAgeSeconds: 3600 }), false)
  assert.equal(isPublishable(twoHours, { now: NOW, maxAgeSeconds: 6 * 3600 }), true)
})

test('a well-formed challenger result passes validation', () => {
  const result = { predictions: Array.from({ length: 14 }, (_, i) => 200 + i) }
  const outcome = validateChallengerResult(result, { horizon: 14 })
  assert.equal(outcome.ok, true)
  assert.deepEqual(outcome.problems, [])
})

test('a short prediction array is rejected', () => {
  const outcome = validateChallengerResult({ predictions: [1, 2, 3] }, { horizon: 14 })
  assert.equal(outcome.ok, false)
  assert.ok(outcome.problems.some((p) => /at least 14/.test(p)))
})

test('non-finite and negative predictions are rejected', () => {
  const withNaN = { predictions: Array.from({ length: 14 }, () => NaN) }
  assert.equal(validateChallengerResult(withNaN, { horizon: 14 }).ok, false)

  const withNull = { predictions: Array.from({ length: 14 }, () => null) }
  assert.equal(validateChallengerResult(withNull, { horizon: 14 }).ok, false)

  const negative = { predictions: Array.from({ length: 14 }, () => -3) }
  assert.equal(validateChallengerResult(negative, { horizon: 14 }).ok, false)
})

test('a non-object or missing payload is rejected without throwing', () => {
  for (const bad of [null, undefined, 'ok', 5, {}]) {
    assert.equal(validateChallengerResult(bad, { horizon: 14 }).ok, false)
  }
})

test('the record carries consecutive dates starting tomorrow', () => {
  const record = buildForecastRecord({
    predictions: [230, 240, 250],
    lower: [214, 224, 234],
    upper: [248, 258, 268],
    model: 'google/timesfm-2.5-200m-pytorch',
    latencyMs: 1900,
    historyHash: 'abc123',
    horizon: 3,
  })

  assert.equal(record.forecast.length, 3)
  assert.equal(record.engine, 'timesfm-2.5')
  assert.equal(record.band, 'p10-p90')

  const dates = record.forecast.map((point) => point.date)
  const unique = new Set(dates)
  assert.equal(unique.size, 3, 'dates must not repeat')
  assert.ok(dates[0] > record.generatedAt.slice(0, 10), 'first point must be in the future')
  assert.deepEqual(record.forecast.map((p) => p.value), [230, 240, 250])
  assert.equal(record.forecast[0].offsetDays, 1)
})

test('a record without bands says so instead of inventing one', () => {
  const record = buildForecastRecord({
    predictions: [230],
    lower: undefined,
    upper: undefined,
    model: 'm',
    latencyMs: 1,
    historyHash: 'h',
    horizon: 1,
  })
  assert.equal(record.band, null)
  assert.equal(record.forecast[0].lower, null)
})

test('the series hash is stable, order-sensitive and change-sensitive', () => {
  const series = [100, 150, 200]
  assert.equal(hashSeries(series), hashSeries([100, 150, 200]))
  assert.notEqual(hashSeries(series), hashSeries([200, 150, 100]))
  assert.notEqual(hashSeries(series), hashSeries([100, 150, 201]))
  assert.match(hashSeries(series), /^[0-9a-f]+$/)
})

test('a record built by the batch is immediately publishable', () => {
  const record = buildForecastRecord({
    predictions: Array.from({ length: 14 }, (_, i) => 200 + i),
    lower: [190, 190, 190],
    upper: [210, 210, 210],
    model: 'm',
    latencyMs: 1800,
    historyHash: 'h',
    horizon: 14,
  })
  // Allow a small clock delta: the record is stamped "now".
  assert.equal(isPublishable(record, { now: Date.now() + 1000 }), true)
})