const { buildForecastReport, buildSyntheticHistory } = require('../shared/forecast-engine.js')
const { describeApi } = require('../shared/service-info.js')

// CORS is configured on the HTTP API itself (infra/template.yaml). Adding these
// headers here too would produce duplicate Access-Control-* values and browsers
// reject the preflight.
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'public, max-age=300',
}

const MAX_HORIZON = 30
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
      return respond(200, describeApi(originOf(event)))
    }

    const params = event.queryStringParameters ?? {}

    const horizon = clamp(Number(params.horizon) || 14, 1, MAX_HORIZON)
    const unitMargin = Number(params.unitMargin) || 18500

    // A body may carry a real history: { history: number[] }
    const provided = parseProvidedHistory(event.body)
    const usingProvidedData = provided !== null

    if (usingProvidedData && provided.length < MIN_HISTORY) {
      return respond(400, {
        error: `history must contain at least ${MIN_HISTORY} daily observations, received ${provided.length}`,
      })
    }

    const history = usingProvidedData ? provided : buildSyntheticHistory()

    const report = buildForecastReport(history, { horizon, unitMargin })

    return respond(200, {
      generatedAt: new Date().toISOString(),
      dataSource: usingProvidedData ? 'provided' : 'synthetic',
      ...report,
    })
  } catch (error) {
    console.error('forecast_failed', { message: error.message })
    return respond(500, { error: 'forecast_failed', message: error.message })
  }
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
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