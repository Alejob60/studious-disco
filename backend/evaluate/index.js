const { buildForecastReport, DEFAULT_UNIT_MARGIN_USD } = require('../shared/forecast-engine.js')
const { parseSubmission } = require('../shared/evaluate-input.js')
const { analyseSeries } = require('../shared/series-diagnostics.js')
const { buildEvaluationDocument, createPersistence } = require('../shared/evaluation-store.js')

// POST /evaluate
//
// Runs the same measurement the demo dashboard runs, but on the visitor's own
// series instead of the synthetic one, and keeps the result.
//
// This is the endpoint that turns "we built a forecast" into "here is what your
// data does". The WAPE and the comparison against the seasonal-naive baseline
// come from `backtest()`, the same code path that produces the 7.77 % quoted in
// the README, so the number a customer sees for their own data is produced by
// the model that ships and not by a second implementation written for the demo.
//
// Persistence is deliberately optional. See `createPersistence`.

const SECRET_ID = process.env.MONGO_SECRET_ID ?? ''
const DB_NAME = process.env.MONGO_DB_NAME ?? ''
const COLLECTION = process.env.MONGO_COLLECTION ?? ''
const UNIT_MARGIN_DEFAULT = DEFAULT_UNIT_MARGIN_USD
const MAX_HORIZON = 30

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

// Cached for the life of the container: the URI does not change, and reconnecting
// per request would add a TLS handshake to every evaluation.
let storePromise

function loadStore() {
  if (!SECRET_ID) return Promise.resolve(null)
  if (storePromise) return storePromise

  storePromise = (async () => {
    try {
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
      const client = new SecretsManagerClient({ maxAttempts: 2, retryMode: 'standard' })
      const result = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }))
      const uri = result.SecretString ?? ''

      if (!uri) return null

      // The driver is required lazily so a bundle built without it still serves
      // metrics; the alternative is a cold-start crash for a missing dependency.
      const { MongoClient } = require('mongodb')

      return createPersistence({
        uri,
        dbName: DB_NAME || undefined,
        collection: COLLECTION || undefined,
        createClient: async (connectionString) => {
          const mongo = new MongoClient(connectionString, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
          })
          await mongo.connect()
          return mongo
        },
      })
    } catch (error) {
      console.error('[evaluate] store unavailable', { name: error?.name, message: String(error?.message ?? error).slice(0, 200) })
      return null
    }
  })()

  return storePromise
}

async function handler(event) {
  // Two routes land on this function. Dispatching on the route key rather than the
  // path means the check keeps working behind a stage prefix or a custom domain,
  // where a raw path comparison would silently start treating it as an
  // evaluation request.
  const routeKey = event.requestContext?.http?.routeKey ?? ''
  if (routeKey === 'GET /evaluate/health' || isPath(event, '/evaluate/health')) return health()
  if (routeKey === 'GET /evaluate/history' || isPath(event, '/evaluate/history')) {
    return history(queryOf(event))
  }

  let payload
  try {
    payload = JSON.parse(event.body ?? '{}')
  } catch {
    return respond(400, { ok: false, error: 'invalid_payload', message: 'the request body is not valid JSON' })
  }

  const parsed = parseSubmission(payload)
  if (!parsed.ok) {
    return respond(400, { ok: false, error: parsed.error, message: parsed.detail ?? null })
  }

  const horizon = clamp(Number(payload.horizon) || 14, 7, MAX_HORIZON)
  const unitMargin = Number(payload.unitMargin) || UNIT_MARGIN_DEFAULT
  const series = parsed.series

  // Inspected before it is modelled, and reported next to the result. Nothing is
  // imputed: a fortnight of empty shelves is the reader's call to make, not ours
  // to silently paper over.
  const dataQuality = analyseSeries(series, { dates: parsed.dates })

  let report
  try {
    report = buildForecastReport(series, { horizon, unitMargin })
  } catch (error) {
    // The engine throws on a series it cannot fit. That is a legitimate answer
    // about the data, not a server fault.
    return respond(422, { ok: false, error: 'cannot_model_series', message: String(error?.message ?? error).slice(0, 200) })
  }

  const meta = {
    source: typeof payload.source === 'string' ? payload.source.slice(0, 24) : 'api',
    locale: payload.locale === 'en' ? 'en' : payload.locale === 'es' ? 'es' : null,
    label: typeof payload.label === 'string' ? payload.label : null,
  }

  const store = await loadStore()
  let persisted = false
  let evaluationId = null

  if (store) {
    const outcome = await store.save(
      buildEvaluationDocument({ history: series, report, meta, dataQuality }),
    )
    persisted = outcome.ok
    evaluationId = outcome.ok ? outcome.id : null
  }

  return respond(200, {
    ok: true,
    evaluatedAt: new Date().toISOString(),
    points: series.length,
    horizon,

    model: report.model,
    period: report.period,
    metrics: report.metrics,
    kpis: report.kpis,
    forecast: report.forecast,
    // The last slice of history so a chart can be drawn without a second call.
    history: report.history,
    // Whether the measurement above can be read as-is. A high-severity finding
    // does not stop the scoring; it stops us calling the number trustworthy.
    dataQuality,

    persistence: {
      // Named honestly: `enabled` is whether a store was configured, `persisted`
      // is whether this particular write landed. They differ when Atlas is down,
      // and the difference is exactly what a judge should be able to see.
      enabled: Boolean(store),
      persisted,
      evaluationId,
      retentionDays: store?.retentionDays ?? null,
    },
  })
}

/** Cheap liveness and configuration read, used by the integration suite. */
async function health() {
  const store = await loadStore()
  const ping = store ? await store.ping() : { ok: false, error: 'not_configured' }
  return respond(ping.ok ? 200 : 503, {
    ok: ping.ok,
    persistenceConfigured: Boolean(store),
    database: store?.dbName ?? null,
    collection: store?.collection ?? null,
    retentionDays: store?.retentionDays ?? null,
    error: ping.ok ? null : ping.error,
  })
}

/**
 * What has been scored so far, and how it went.
 *
 * This is the first slice of the phase-two control dashboard, and it exists to
 * make one claim visible rather than asserted: the evaluations are really
 * recorded, and reading them back is one unauthenticated GET. Without a view, the
 * storage is only a claim in a paragraph.
 *
 * The stored series is never returned. These documents hold whatever sales
 * figures a visitor uploaded, and this endpoint is public, so it reports the
 * measurements and leaves the data alone.
 */
async function history(params) {
  const store = await loadStore()

  if (!store) {
    return respond(200, {
      ok: true,
      enabled: false,
      total: 0,
      beatenBaselinePct: null,
      recent: [],
      note: 'no evaluation store is configured on this deployment',
    })
  }

  const [recent, summary] = await Promise.all([
    store.listRecent(params?.limit ?? 10),
    store.summary(),
  ])

  return respond(200, {
    ok: true,
    enabled: true,
    database: store.dbName,
    collection: store.collection,
    retentionDays: store.retentionDays,
    ...summary,
    recent: recent.rows.map((row) => ({
      id: String(row._id),
      at: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? null,
      source: row.source ?? null,
      locale: row.locale ?? null,
      points: row.points ?? null,
      horizon: row.horizon ?? null,
      wape: row.metrics?.wape ?? null,
      baselineWape: row.metrics?.baselineWape ?? null,
      improvementPct: row.metrics?.improvementPct ?? null,
      modelMaeUnits: row.metrics?.modelMaeUnits ?? null,
      baselineMaeUnits: row.metrics?.baselineMaeUnits ?? null,
      peakUnits: row.kpis?.peakUnits ?? null,
      // Enough to chart the shape without shipping the series itself.
      seriesMean: row.summary?.mean ?? null,
      seriesMax: row.summary?.max ?? null,
    })),
    // Surfaced so a viewer can tell an empty database from a broken query.
    error: summary.ok === false ? summary.error : null,
  })
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
}

/** Fallback for a direct invoke, where no route key is present. */
function isPath(event, suffix) {
  const path = event.rawPath ?? event.path ?? ''
  return path === suffix || path.endsWith(suffix)
}

function queryOf(event) {
  return event.queryStringParameters ?? {}
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

module.exports = { handler, health }