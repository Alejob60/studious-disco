/**
 * Nightly forecast refresh.
 *
 * EventBridge cannot target App Runner directly, so this small Lambda is the
 * orchestrator:
 *
 *   EventBridge schedule
 *     -> this function
 *       -> reads the history from S3 (or falls back to the deterministic demo series)
 *       -> POSTs to the TimesFM service on App Runner
 *       -> validates the response and writes forecast.json back to S3
 *
 * The dashboard's forecast Lambda then serves that file when it is fresh, and
 * otherwise recomputes with Holt-Winters in ~1 ms. A stale or malformed
 * challenger result can therefore never degrade the synchronous path.
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')

const {
  DEFAULT_HISTORY_KEY,
  DEFAULT_HORIZON,
  FORECAST_KEY,
  buildForecastRecord,
  hashSeries,
  validateChallengerResult,
} = require('../shared/forecast-record.js')

const { buildSyntheticHistory } = require('../shared/forecast-engine.js')

const BUCKET = process.env.FORECAST_BUCKET ?? ''
const HISTORY_KEY = process.env.HISTORY_KEY ?? DEFAULT_HISTORY_KEY
const FORECAST_KEY_NAME = process.env.FORECAST_KEY ?? FORECAST_KEY
const SERVICE_URL = (process.env.TIMESFM_SERVICE_URL ?? '').replace(/\/+$/, '')
const HORIZON = Number(process.env.FORECAST_HORIZON) || DEFAULT_HORIZON
const CALL_TIMEOUT_MS = Number(process.env.TIMESFM_TIMEOUT_MS) || 25_000

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const s3 = new S3Client({ maxAttempts: 3, retryMode: 'standard' })

async function main() {
  if (!BUCKET || !SERVICE_URL) {
    return respond(500, { ok: false, error: 'missing_configuration', bucket: Boolean(BUCKET), serviceUrl: Boolean(SERVICE_URL) })
  }

  const history = await loadHistory()
  const historyHash = hashSeries(history)

  const response = await fetch(`${SERVICE_URL}/forecast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, horizon: HORIZON }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(`[batch] timesfm status=${response.status} detail=${detail.slice(0, 200)}`)
    return respond(502, { ok: false, error: 'challenger_unavailable', status: response.status })
  }

  const result = await response.json()
  const validation = validateChallengerResult(result, { horizon: HORIZON })

  if (!validation.ok) {
    // Leave the previous forecast untouched: the champion keeps serving.
    console.error('[batch] challenger result rejected', { problems: validation.problems })
    return respond(502, { ok: false, error: 'challenger_result_invalid', problems: validation.problems })
  }

  const record = buildForecastRecord({
    predictions: validation.predictions,
    lower: result.lower,
    upper: result.upper,
    model: result.model,
    latencyMs: result.inference_ms,
    historyHash,
    horizon: HORIZON,
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: FORECAST_KEY_NAME,
      Body: JSON.stringify(record),
      ContentType: 'application/json',
      // The forecast Lambda serves this object directly, so it must be readable
      // only by that role, never via a public URL.
      ServerSideEncryption: 'AES256',
      Metadata: { engine: record.engine, historyHash },
    }),
  )

  console.log('[batch] forecast published', {
    engine: record.engine,
    points: record.forecast.length,
    latencyMs: record.latencyMs,
  })

  return respond(200, { ok: true, engine: record.engine, points: record.forecast.length, latencyMs: record.latencyMs })
}

/**
 * Loads the real history when one has been uploaded, otherwise the deterministic
 * demo series. The demo path keeps the pipeline runnable before any customer data
 * exists, which is exactly the state we are in.
 */
async function loadHistory() {
  try {
    const result = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: HISTORY_KEY }))
    const parsed = JSON.parse(await result.Body.transformToString())
    const values = Array.isArray(parsed) ? parsed : parsed?.history

    if (!Array.isArray(values) || values.length < 28) {
      console.warn(`[batch] ${HISTORY_KEY} present but unusable, falling back to demo series`)
      return buildSyntheticHistory()
    }

    return values.map(Number).filter((value) => Number.isFinite(value))
  } catch (error) {
    if (error?.name === 'NoSuchKey') {
      return buildSyntheticHistory()
    }
    console.error('[batch] could not read history', { name: error?.name, message: error?.message })
    return buildSyntheticHistory()
  }
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
}

async function handler(event) {
  try {
    return await main()
  } catch (error) {
    console.error('batch_failed', { name: error.name, message: error.message })
    return respond(500, { ok: false, error: 'batch_failed', message: error.message })
  }
}

module.exports = { handler }

