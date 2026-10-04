/**
 * Nightly forecast refresh.
 *
 * EventBridge cannot target a container function's inference endpoint directly,
 * so this small Lambda is the orchestrator:
 *
 *   EventBridge schedule
 *     -> this function
 *       -> reads the history from S3 (or falls back to the deterministic demo series)
 *       -> invokes the inference Lambda synchronously
 *       -> validates the response and writes forecast.json back to S3
 *
 * Synchronous invocation on purpose: the result is needed before we can decide
 * whether to publish, and RequestResponse keeps the payload under 6 MB instead of
 * routing it through Lambda destinations.
 *
 * The dashboard's forecast Lambda then serves that file when it is fresh, and
 * otherwise recomputes with Holt-Winters in ~1 ms. A stale or malformed
 * challenger result can therefore never degrade the synchronous path.
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3')
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda')

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
const INFERENCE_FUNCTION = process.env.INFERENCE_FUNCTION_NAME ?? ''
const HORIZON = Number(process.env.FORECAST_HORIZON) || DEFAULT_HORIZON

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const s3 = new S3Client({ maxAttempts: 3, retryMode: 'standard' })
const lambda = new LambdaClient({ maxAttempts: 2, retryMode: 'standard' })

/**
 * Runs inference and returns the parsed body.
 *
 * The cold-start cost lands here: the image is pulled and the model loads on the
 * first invocation of the day. Failures surface as Lambda function errors rather
 * than HTTP statuses, so both shapes are handled.
 */
async function runInference(history) {
  const result = await lambda.send(
    new InvokeCommand({
      FunctionName: INFERENCE_FUNCTION,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({ history, horizon: HORIZON })),
    })
  )

  if (result.FunctionError) {
    const detail = Buffer.from(result.Payload ?? '').toString('utf8').slice(0, 300)
    throw new Error(`inference function error (${result.FunctionError}): ${detail}`)
  }

  const status = result.StatusCode ?? 0
  if (status !== 200) {
    throw new Error(`inference function returned status ${status}`)
  }

  const body = JSON.parse(Buffer.from(result.Payload).toString('utf8'))
  // The container app answers on its own HTTP port; RequestResponse surfaces that
  // response as the payload when the function is wrapped by Lambda.
  return body && typeof body === 'object' && 'statusCode' in body ? JSON.parse(body.body) : body
}

async function main() {
  if (!BUCKET || !INFERENCE_FUNCTION) {
    return respond(500, {
      ok: false,
      error: 'missing_configuration',
      bucket: Boolean(BUCKET),
      inferenceFunction: Boolean(INFERENCE_FUNCTION),
    })
  }

  const history = await loadHistory()
  const historyHash = hashSeries(history)

  let result
  try {
    result = await runInference(history)
  } catch (error) {
    // Leave the previous forecast untouched: the champion keeps serving.
    console.error('[batch] challenger unavailable', { message: error.message })
    return respond(502, { ok: false, error: 'challenger_unavailable' })
  }

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
    // Not having uploaded a history yet is the expected state on a fresh bucket,
    // so it is a debug line rather than an error the operator has to chase.
    if (error?.name === 'NoSuchKey') {
      return buildSyntheticHistory()
    }
    if (error?.name === 'AccessDenied') {
      console.warn(`[batch] ${HISTORY_KEY} unreadable, using the demo series`)
      return buildSyntheticHistory()
    }
    console.error('[batch] could not read history', { name: error?.name, message: error?.message })
    return buildSyntheticHistory()
  }
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
}

async function handler() {
  try {
    return await main()
  } catch (error) {
    console.error('batch_failed', { name: error.name, message: error.message })
    return respond(500, { ok: false, error: 'batch_failed', message: error.message })
  }
}

module.exports = { handler }

