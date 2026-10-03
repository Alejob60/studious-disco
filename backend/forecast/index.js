const { buildForecastReport, buildSyntheticHistory } = require('../shared/forecast-engine.js')
const { describeApi } = require('../shared/service-info.js')
const { TtlCache, FORECAST_TTL_MS } = require('../shared/ttl-cache.js')

// One cache per warm container. The synthetic history is deterministic, so a hit
// returns a byte-identical response and saves the whole Holt-Winters run.
const reportCache = new TtlCache(FORECAST_TTL_MS, 16)

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
    const unitMargin = Number(params.unitMargin) || 18500

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

module.exports = { handler }
