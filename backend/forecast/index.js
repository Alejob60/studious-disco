const { buildForecastReport, buildSyntheticHistory, DEFAULT_UNIT_MARGIN_USD } = require('../shared/forecast-engine.js')
const { describeApi } = require('../shared/service-info.js')
const { TtlCache, FORECAST_TTL_MS } = require('../shared/ttl-cache.js')
const { hashSeries, isPublishable } = require('../shared/forecast-record.js')

// One cache per warm container. The synthetic history is deterministic, so a hit
// returns a byte-identical response and saves the whole Holt-Winters run.
const reportCache = new TtlCache(FORECAST_TTL_MS, 16)

// Precomputed challenger forecast, when the nightly job has published one.
//
// This is the one AWS call the champion path makes. It used to make none, and
// that property is deliberately given up: serving TimesFM's 5.61% WAPE requires
// reading the file it wrote. The cost is a single S3 GET (~20 ms) against a ~1 ms
// compute, and an unreadable or stale object falls back to local computation, so
// the fast path is never blocked by it.
const FORECAST_BUCKET = process.env.FORECAST_BUCKET ?? ''
const PRECOMPUTED_KEY = process.env.FORECAST_KEY ?? 'forecast.json'
const PRECOMPUTED_MAX_AGE_SECONDS = Number(process.env.FORECAST_MAX_AGE_SECONDS) || 36 * 3600

let s3Client = null
let GetObjectCommand = null
if (FORECAST_BUCKET) {
  // The SDK is only packaged when the bundle is built with --with-s3. A Lambda
  // built without it must still serve the champion, so a missing module degrades
  // to "no challenger" instead of failing the whole function at cold start.
  try {
    const sdk = require('@aws-sdk/client-s3')
    s3Client = new sdk.S3Client({ maxAttempts: 2, retryMode: 'standard' })
    GetObjectCommand = sdk.GetObjectCommand
  } catch (error) {
    s3Client = null
    console.error('[forecast] FORECAST_BUCKET is set but the S3 SDK is not in this bundle', {
      name: error?.code ?? error?.name,
    })
  }
}

/** Reads the challenger forecast, returning null when absent or not publishable. */
async function loadPrecomputed(history, horizon) {
  if (!s3Client) return null

  try {
    const result = await s3Client.send(new GetObjectCommand({ Bucket: FORECAST_BUCKET, Key: PRECOMPUTED_KEY }))
    const record = JSON.parse(await result.Body.transformToString())

    if (!isPublishable(record, { maxAgeSeconds: PRECOMPUTED_MAX_AGE_SECONDS })) return null
    // A forecast computed with a different horizon or from different data must
    // not be served for this request.
    if (record.horizon !== horizon) return null
    if (record.historyHash && record.historyHash !== hashSeries(history)) return null

    return record
  } catch (error) {
    if (error?.name !== 'NoSuchKey') {
      console.warn('[forecast] precomputed read failed, using champion', { name: error?.name })
    }
    return null
  }
}

// CORS is configured on the HTTP API itself (infra/template.yaml). Adding these
// headers here too would produce duplicate Access-Control-* values and browsers
// reject the preflight.
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
}

const MAX_HORIZON = 30
const MAX_HISTORY_POINTS = 365
// 28 is the minimum Holt-Winters needs, and keeps the default payload well under
// the 90 points the synthetic demo produces.
const MAX_HISTORY_WINDOW = 28
const MIN_HISTORY = 28

/**
 * GET /forecast
 *
 * Returns the Holt-Winters projection plus the backtest metrics that justify it.
 * Optionally accepts a real history via POST so this stops being synthetic the
 * day you wire up actual POS data — no code change needed, just send the array.
 */
async function handler(event) {
  try {
    // `GET /` is the API index. It answers on the forecast function because that
    // function makes no AWS calls at all, so it is the cheapest place to host it.
    if (isIndexRequest(event)) {
      return respond(200, { ...describeApi(originOf(event)), cache: cacheStatsForIndex() })
    }

    const params = event.queryStringParameters ?? {}

    const horizon = clamp(Number(params.horizon) || 14, 1, MAX_HORIZON)
    // USD contribution margin per unit. `undefined` lets the engine apply its own
// default, so the number lives in one place rather than two.
const unitMargin = Number(params.unitMargin) || DEFAULT_UNIT_MARGIN_USD

    // `window` trims the history returned to the caller. The model always fits the
    // full series; this only limits the payload, so a chart that draws 21 days
    // does not download 90.
    const window = clamp(Number(params.window) || MAX_HISTORY_WINDOW, 7, MAX_HISTORY_POINTS)

    // A body may carry a real history: { history: number[] }
    const provided = parseProvidedHistory(event.body)
    const usingProvidedData = provided !== null

    if (usingProvidedData && provided.length < MIN_HISTORY) {
      return respond(400, {
        error: `history must contain at least ${MIN_HISTORY} daily observations, received ${provided.length}`,
      })
    }

const history = usingProvidedData ? provided : buildSyntheticHistory()

    const key = TtlCache.forecastKey(history, horizon, unitMargin)
    const cached = reportCache.get(key)

    // The cache stores the untrimmed report on purpose: `window` changes only the
    // payload, not the computation, so one entry serves every window size.
    const base = cached ?? reportCache.set(key, buildForecastReport(history, { horizon, unitMargin }))
    const hit = Boolean(cached)

    // Challenger first: if the nightly job published a fresh forecast for this
    // exact data, it wins. Anything missing, stale or mismatched falls through to
    // the champion, which is why the fast path can never be degraded by the
    // challenger being down.
    const precomputed = await loadPrecomputed(history, horizon)

    if (precomputed) {
      const overridden = applyPrecomputed(base, precomputed)
      return respond(200, {
        generatedAt: new Date().toISOString(),
        dataSource: usingProvidedData ? 'provided' : 'synthetic',
        ...overridden,
        historyPointsFitted: base.history.length,
        history: base.history.slice(-window),
        window,
        cache: { hit, ...reportCache.stats() },
      })
    }

    return respond(200, {
      generatedAt: new Date().toISOString(),
      dataSource: usingProvidedData ? 'provided' : 'synthetic',
      ...base,
      // The model always fits the full series; only the response is trimmed.
      historyPointsFitted: base.history.length,
      history: base.history.slice(-window),
      window,
      cache: { hit, ...reportCache.stats() },
    })
  } catch (error) {
    console.error('forecast_failed', { message: error.message })
    return respond(500, { error: 'forecast_failed', message: error.message })
  }
}

/**
 * Replaces the champion's projection with the challenger's.
 *
 * The champion report keeps supplying the history, the labels and the backtest
 * metrics; only the point values and bands come from the challenger. The backtest
 * block stays labelled as the champion's, because it was computed by the
 * champion, and `forecast.wapePct` records the challenger's measured accuracy so
 * the UI can attribute it.
 */
function applyPrecomputed(championReport, record) {
  return {
    ...championReport,
    forecast: record.forecast.map((point) => ({
      label: point.date ? labelFromIso(point.date) : point.label,
      date: point.date,
      value: point.value,
      lower: point.lower ?? championReport.forecast[0]?.lower ?? 0,
      upper: point.upper ?? championReport.forecast[0]?.upper ?? point.value,
    })),
    engine: {
      name: record.engine,
      model: record.model,
      generatedAt: record.generatedAt,
      band: record.band,
      latencyMs: record.latencyMs,
      // The numbers behind these were measured in benchmarks/, not per request.
      measuredWapePct: CHALLENGER_MEASURED_WAPE,
      championWapePct: championReport.metrics.wape,
    },
  }
}

const CHALLENGER_MEASURED_WAPE = 5.61

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

function labelFromIso(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return `${DAY_ABBR[date.getDay()]} ${String(day).padStart(2, '0')}`
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
}

/** Exposes cache hit rate at the API root so the optimisation is observable. */
function cacheStatsForIndex() {
  return { report: reportCache.stats(), ttlSeconds: FORECAST_TTL_MS / 1000 }
}

/** True for the bare root path, whether routing came from a route key or a raw path. */
function isIndexRequest(event) {
  const routeKey = event.requestContext?.http?.routeKey
  if (routeKey) return routeKey === 'GET /'
  const path = event.rawPath ?? event.path ?? ''
  return path === '/' || path === ''
}

/**
 * Best-effort absolute origin, used only to build the llms.txt link in the index.
 * Falling back to an empty string is preferable to failing the request.
 */
function originOf(event) {
  const headers = event.headers ?? {}
  const host = headers.host ?? headers.Host
  if (!host) return ''
  return `${headers['x-forwarded-proto'] ?? 'https'}://${host}`
}

/** Validates the optional request body and returns a clean numeric series. */
function parseProvidedHistory(body) {
  if (!body) return null

  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('request body is not valid JSON')
  }

  const history = parsed?.history
  if (!Array.isArray(history) || history.length === 0) return null

  return history.map((value) => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric < 0) {
      throw new Error('history must contain only finite, non-negative numbers')
    }
    return numeric
  })
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

// applyPrecomputed is exported for tests: merging a challenger record into a
// champion report is the one piece of this file with branching worth pinning down.
module.exports = { handler, applyPrecomputed }

