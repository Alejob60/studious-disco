const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { join, resolve } = require('node:path')
const { readFileSync } = require('node:fs')

const repoRoot = resolve(__dirname, '..', '..')
const forecastSource = readFileSync(join(repoRoot, 'backend', 'forecast', 'index.js'), 'utf8')

// The bundler lays each function out as .staging/<name>/<entry>, so the staged
// entry repeats the function folder: .staging/forecast/forecast/index.js.
const stagedForecast = join(repoRoot, 'infra', '.staging', 'forecast', 'forecast', 'index.js')

// The handler treats an event with no path as the API root, so each test states
// the route it means instead of relying on that default.
const FORECAST_EVENT = { rawPath: '/forecast', requestContext: { http: { routeKey: 'GET /forecast' } } }
const INDEX_EVENT = { rawPath: '/', requestContext: { http: { routeKey: 'GET /' } } }

const INVOKE =
  'const e=JSON.parse(process.argv[2]);' +
  'require(process.argv[1]).handler(e).then(r=>console.log(JSON.stringify(r)))'

/**
 * Invokes the staged forecast bundle in a child process and returns the parsed
 * payload. A thrown or non-2xx result is reported as a test failure by the caller.
 */
function callForecast(env, event = FORECAST_EVENT) {
  const response = runStagedForecast(env, event)
  assert.equal(response.status, 0, `the function must not crash: ${response.stdout}`)
  const envelope = JSON.parse(response.stdout)
  assert.equal(envelope.statusCode, 200, `unexpected status: ${envelope.body}`)
  // The payload is a JSON string inside the Lambda envelope, not the envelope itself.
  return JSON.parse(envelope.body)
}
function runStagedForecast(env, event = FORECAST_EVENT) {
  try {
    const stdout = execFileSync(
      process.execPath,
      ['-e', INVOKE, stagedForecast, JSON.stringify(event)],
      { env: { ...process.env, ...env }, encoding: 'utf8', timeout: 60_000 }
    )
    return { status: 0, stdout }
  } catch (error) {
    return { status: error.status ?? 1, stdout: `${error.stdout ?? ''}${error.stderr ?? ''}` }
  }
}

test('the champion path never reads S3 when no bucket is configured', () => {
  const payload = callForecast({ FORECAST_BUCKET: '' })
  assert.equal(payload.forecast.length, 14)
  // No challenger means no engine block: the response is the champion's own.
  assert.equal(payload.engine, undefined)
})

test('the API index answers without any AWS access', () => {
  const payload = callForecast({ FORECAST_BUCKET: '' }, INDEX_EVENT)
  assert.ok(Array.isArray(payload.endpoints))
})

test('a configured bucket without the SDK degrades to the champion instead of crashing', () => {
  // The staged bundle is built without --with-s3, so the S3 SDK is absent. This
  // is the exact shape of a mis-deployed challenger, and it must not take /forecast
  // down: the champion has to keep answering.
  const payload = callForecast({ FORECAST_BUCKET: 'a-bucket-that-does-not-matter' })
  assert.equal(payload.forecast.length, 14)
  assert.equal(payload.engine, undefined)
})

test('the S3 SDK is required lazily and guarded, never at module top level', () => {
  // A top-level require would execute on cold start regardless of configuration.
  const requireLines = forecastSource
    .split('\n')
    .map((line, index) => ({ line: line.trim(), index }))
    .filter((entry) => /require\('@aws-sdk/.test(entry.line))

  assert.ok(requireLines.length > 0, 'expected the S3 SDK to be required somewhere')
  for (const entry of requireLines) {
    assert.ok(
      entry.index > 0 && forecastSource.split('\n')[entry.index - 1].includes('try {'),
      `the AWS SDK require must sit inside a try block (line ${entry.index + 1})`
    )
  }
})

test('applyPrecomputed keeps the champion history and labels', () => {
  const { applyPrecomputed } = require('../forecast/index.js')
  const championReport = {
    history: [100, 110, 120],
    forecast: [
      { label: 'vie 04', date: '2026-10-04', value: 999, lower: 1, upper: 2 },
      { label: 'sáb 05', date: '2026-10-05', value: 999, lower: 1, upper: 2 },
    ],
    metrics: { wape: 7.77, method: 'holt-winters' },
  }
  const record = {
    engine: 'timesfm-2.5',
    model: 'google/timesfm-2.5-200m-pytorch',
    generatedAt: '2026-10-03T04:30:00.000Z',
    band: 'p10-p90',
    latencyMs: 1900,
    forecast: [
      { date: '2026-10-04', value: 230, lower: 214, upper: 248 },
      { date: '2026-10-05', value: 240, lower: 224, upper: 258 },
    ],
  }

  const merged = applyPrecomputed(championReport, record)
  assert.deepEqual(merged.history, championReport.history)
  assert.deepEqual(merged.metrics, championReport.metrics, 'backtest metrics stay the champion ones')
  assert.deepEqual(merged.forecast.map((p) => p.value), [230, 240], 'values come from the challenger')
  assert.deepEqual(merged.forecast.map((p) => p.label), ['Dom 04', 'Lun 05'])
  assert.equal(merged.engine.name, 'timesfm-2.5')
  assert.equal(merged.engine.measuredWapePct, 5.61)
  assert.equal(merged.engine.championWapePct, 7.77)
})

test('applyPrecomputed falls back to the champion band when the challenger sends none', () => {
  const { applyPrecomputed } = require('../forecast/index.js')
  const championReport = {
    history: [100],
    forecast: [{ label: 'x', date: '2026-10-04', value: 999, lower: 10, upper: 20 }],
    metrics: { wape: 7.77 },
  }
  const record = {
    engine: 'timesfm-2.5',
    model: 'm',
    generatedAt: '2026-10-03T04:30:00.000Z',
    band: null,
    latencyMs: 1900,
    forecast: [{ date: '2026-10-04', value: 230, lower: null, upper: null }],
  }

  const merged = applyPrecomputed(championReport, record)
  assert.equal(merged.forecast[0].lower, 10)
  assert.equal(merged.forecast[0].upper, 20)
})