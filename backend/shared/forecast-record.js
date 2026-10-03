/**
 * Pure decision logic for the nightly forecast refresh.
 *
 * Split out from `index.js` so the rules — which history to use, whether the
 * challenger result is trustworthy enough to publish, how to age out a stale
 * forecast — are unit testable without a Lambda runtime or a network.
 */

const DEFAULT_HORIZON = 14
const DEFAULT_HISTORY_KEY = 'history.json'
const FORECAST_KEY = 'forecast.json'

/**
 * Decides whether a precomputed forecast may be served.
 *
 * A stale forecast is worse than no forecast: the champion recomputes in 1 ms,
 * so falling back is free, while serving yesterday's numbers as if they were
 * today's would be quietly wrong.
 */
function isPublishable(record, { now = Date.now(), maxAgeSeconds = 36 * 3600 } = {}) {
  if (!record || typeof record !== 'object') return false
  if (!Array.isArray(record.forecast) || record.forecast.length === 0) return false
  if (typeof record.generatedAt !== 'string') return false

  const generatedAt = Date.parse(record.generatedAt)
  if (Number.isNaN(generatedAt)) return false

  const ageSeconds = (now - generatedAt) / 1000
  if (ageSeconds < -300) return false // clock skew: reject timestamps from the future
  return ageSeconds <= maxAgeSeconds
}

/**
 * Rejects a challenger result that is obviously broken.
 *
 * The challenger is a black box behind an HTTP call. Without these guards a
 * malformed response would overwrite a good forecast and the dashboard would
 * show nonsense with a confident label on it.
 */
function validateChallengerResult(result, { horizon = DEFAULT_HORIZON } = {}) {
  const problems = []

  if (!result || typeof result !== 'object') {
    return { ok: false, problems: ['response is not an object'] }
  }

  const predictions = result.predictions
  if (!Array.isArray(predictions)) {
    return { ok: false, problems: ['predictions is not an array'] }
  }
  if (predictions.length < horizon) {
    problems.push(`expected at least ${horizon} predictions, got ${predictions.length}`)
  }
  if (predictions.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    problems.push('predictions contain non-finite values')
  }
  if (predictions.some((value) => value < 0)) {
    problems.push('predictions contain negative values')
  }

  return { ok: problems.length === 0, problems, predictions }
}

/** Builds the record the forecast Lambda later reads and serves. */
function buildForecastRecord({ predictions, lower, upper, model, latencyMs, historyHash, horizon }) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 1)

  return {
    version: 1,
    engine: 'timesfm-2.5',
    model,
    generatedAt: new Date().toISOString(),
    horizon,
    historyHash,
    latencyMs,
    // Without bands we say so rather than inventing a symmetric interval.
    band: Array.isArray(lower) && Array.isArray(upper) ? 'p10-p90' : null,
    forecast: predictions.map((value, index) => ({
      offsetDays: index + 1,
      date: offsetIsoDate(startDate, index),
      value: Math.round(value),
      lower: Array.isArray(lower) && lower[index] != null ? Math.round(lower[index]) : null,
      upper: Array.isArray(upper) && upper[index] != null ? Math.round(upper[index]) : null,
    })),
  }
}

function offsetIsoDate(start, offsetDays) {
  const date = new Date(start)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Minimal stable hash so a changed history invalidates the cached forecast. */
function hashSeries(values) {
  let hash = 0
  for (const value of values) {
    hash = (hash * 31 + Math.round(value * 1000)) | 0
  }
  return (hash >>> 0).toString(16)
}

module.exports = {
  DEFAULT_HISTORY_KEY,
  DEFAULT_HORIZON,
  FORECAST_KEY,
  buildForecastRecord,
  hashSeries,
  isPublishable,
  validateChallengerResult,
}