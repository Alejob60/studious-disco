/**
 * Statistical demand forecasting engine.
 *
 * Deliberately dependency-free so it can run in a Lambda without a bundle and
 * so the exact same code runs in tests and in the agent's backtest.
 *
 * Method: additive Holt-Winters triple exponential smoothing with a weekly
 * seasonal period (m=7). Retail demand is strongly day-of-week driven, so a
 * plain moving average would systematically miss the weekend peaks.
 */

/** Deterministic PRNG (mulberry32) so the synthetic demo history is reproducible. */
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Gaussian-ish noise via averaging two uniforms; keeps tails realistic. */
function jitter(random) {
  return (random() + random() - 1) * 2
}

/**
 * Builds a synthetic weekly-seasonal history.
 *
 * This is a stand-in for real POS data. It is deliberately not random noise:
 * it has weekend peaks, a gentle upward trend, and a promo spike so the model
 * has something structurally meaningful to find.
 */
function buildSyntheticHistory({ days = 90, seed = 20260601, base = 150 } = {}) {
  const random = mulberry32(seed)
  const values = []

  for (let i = 0; i < days; i += 1) {
    const weekday = i % 7
    // Sunday=0 ... Saturday=6, matching the JS day index used for labels.
    const seasonality = [0.72, 0.94, 0.98, 1.0, 1.06, 1.22, 1.32][weekday]
    const trend = 1 + i * 0.0022
    const promo = i >= days - 21 && i <= days - 18 ? 1.18 : 1
    const value = base * seasonality * trend * promo * (1 + jitter(random) * 0.05)
    values.push(Math.max(1, Math.round(value)))
  }

  return values
}

const DEFAULTS = {
  period: 7,
  alpha: 0.32,
  beta: 0.06,
  gamma: 0.28,
}

/**
 * Additive Holt-Winters. Requires at least `2 * period` observations.
 *
 * @param {number[]} series historical values, oldest first
 * @param {object} [options] smoothing parameters
 * @param {number} options.horizon steps to project forward
 * @returns {number[]} forecast of length `options.horizon`
 */
function holtWinters(series, { period = DEFAULTS.period, alpha = DEFAULTS.alpha, beta = DEFAULTS.beta, gamma = DEFAULTS.gamma, horizon = 14 } = {}) {
  if (series.length < 2 * period) {
    throw new Error(`Holt-Winters needs at least ${2 * period} observations, got ${series.length}`)
  }

  // Initial level = mean of the first season; initial trend = drift between
  // the first two seasons; initial seasonal factors = deviation from level.
  const firstSeason = series.slice(0, period)
  const secondSeason = series.slice(period, 2 * period)

  let level = mean(firstSeason)
  let trend = (mean(secondSeason) - mean(firstSeason)) / period

  const seasonal = firstSeason.map((value, index) => value - level)
  const fitted = []

  // Warm up the state over the history we already have so the level/trend
  // entering the forecast window reflects the whole series, not just 2 weeks.
  for (let t = 0; t < period; t += 1) {
    fitted.push(seasonal[t])
  }

  for (let t = period; t < series.length; t += 1) {
    const seasonIndex = t % period
    const prediction = level + trend + seasonal[seasonIndex]

    const lastLevel = level
    level = alpha * (series[t] - seasonal[seasonIndex]) + (1 - alpha) * (lastLevel + trend)
    trend = beta * (level - lastLevel) + (1 - beta) * trend
    seasonal[seasonIndex] = gamma * (series[t] - level) + (1 - gamma) * (seasonal[seasonIndex])

    fitted.push(level + trend + seasonal[seasonIndex])

    // Guard against runaway trend on flat series.
    if (Math.abs(trend) > 5) trend = Math.sign(trend) * 5
  }

  const forecast = []
  for (let h = 1; h <= horizon; h += 1) {
    const seasonIndex = (series.length + h - 1) % period
    forecast.push(Math.max(0, level + h * trend + seasonal[seasonIndex]))
  }

  return forecast
}

/** Seasonal naive baseline: repeat the value from exactly one week ago. */
function seasonalNaive(series, horizon = 14, period = 7) {
  const forecast = []
  for (let h = 1; h <= horizon; h += 1) {
    const index = series.length - period + ((h - 1) % period)
    forecast.push(series[index])
  }
  return forecast
}

/** Weighted Absolute Percentage Error — the headline accuracy metric. */
function wape(actual, predicted) {
  const numerator = actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0)
  const denominator = actual.reduce((sum, value) => sum + value, 0)
  return denominator === 0 ? 0 : numerator / denominator
}

/** Mean Absolute Percentage Error, capped per point to ignore near-zero blowups. */
function mape(actual, predicted) {
  const errors = actual.map((value, index) => {
    if (value === 0) return 0
    return Math.min(Math.abs(value - predicted[index]) / value, 1)
  })
  return errors.length === 0 ? 0 : errors.reduce((sum, value) => sum + value, 0) / errors.length
}

/**
 * Honest accuracy measurement: hold out the last `holdout` points, fit on the
 * rest, and compare the model against the seasonal-naive baseline on the same
 * window. This is what turns "we have an AI" into "we can prove it works".
 */
function backtest(series, { holdout = 14, period = 7 } = {}) {
  const train = series.slice(0, series.length - holdout)
  const test = series.slice(series.length - holdout)

  const modelForecast = holtWinters(train, { horizon: holdout, period })
  const baselineForecast = seasonalNaive(train, holdout, period)

  const modelWape = wape(test, modelForecast)
  const baselineWape = wape(test, baselineForecast)

  return {
    modelWape,
    baselineWape,
    modelMae: meanAbsoluteError(test, modelForecast),
    baselineMae: meanAbsoluteError(test, baselineForecast),
    mape: mape(test, modelForecast),
    improvement: baselineWape === 0 ? 0 : (baselineWape - modelWape) / baselineWape,
    holdout,
    predictions: modelForecast,
    actuals: test,
  }
}

/** Mean Absolute Error, in units. Directly interpretable for operations. */
function meanAbsoluteError(actual, predicted) {
  if (actual.length === 0) return 0
  const total = actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0)
  return total / actual.length
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/**
 * Formats in local time on purpose: `toISOString()` would shift the calendar
 * day for anyone east of UTC and desync the labels from the seasonal indices.
 */
function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Returns `count` labels for consecutive days ending on `endDate`. */
function buildLabels(count, endDate = new Date()) {
  const labels = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - (count - 1 - i))
    const day = String(date.getDate()).padStart(2, '0')
    labels.push({ label: `${DAY_ABBR[date.getDay()]} ${day}`, date: formatDate(date) })
  }
  return labels
}

/**
 * Full pipeline: history in, chart-ready payload out.
 *
 * `unitMargin` converts the model's error reduction into money, which is the
 * only honest way to quote a "savings" figure — it is derived from the
 * backtest, not invented.
 */
function buildForecastReport(series, { horizon = 14, unitMargin = 18500, period = 7 } = {}) {
  const metrics = backtest(series, { holdout: horizon, period })
  const forecast = holtWinters(series, { horizon, period })

  const historyLabels = buildLabels(series.length)

  // Forecast window starts tomorrow, so its labels must end `horizon` days out.
  const forecastEnd = new Date()
  forecastEnd.setDate(forecastEnd.getDate() + horizon)
  const forecastLabels = buildLabels(horizon, forecastEnd)

  const weekAhead = forecast.slice(0, 7).reduce((sum, value) => sum + value, 0)
  const lastWeekActual = series.slice(-7).reduce((sum, value) => sum + value, 0)
  const previousWeekActual = series.slice(-14, -7).reduce((sum, value) => sum + value, 0)
  const weekDelta = lastWeekActual === 0 ? 0 : (weekAhead - lastWeekActual) / lastWeekActual

  const peak = forecast.reduce(
    (best, value, index) => (value > best.value ? { value, index } : best),
    { value: -Infinity, index: 0 },
  )

  // Residual scale drives the confidence band (±1.96σ for a 95% interval).
  const residuals = metrics.actuals.map((value, index) => value - metrics.predictions[index])
  const sigma = Math.sqrt(mean(residuals.map((value) => value ** 2)))

  const history = series.map((value, index) => ({
    label: historyLabels[index].label,
    date: historyLabels[index].date,
    value,
  }))

  const projection = forecast.map((value, index) => ({
    label: forecastLabels[index].label,
    date: forecastLabels[index].date,
    value: Math.round(value),
    lower: Math.max(0, Math.round(value - 1.96 * sigma)),
    upper: Math.round(value + 1.96 * sigma),
  }))

  // Savings are valued from the backtest, never invented: the model commits
  // fewer wrong units per day than the baseline, priced at contribution margin.
  const unitsSavedPerDay = Math.max(0, metrics.baselineMae - metrics.modelMae)

  return {
    model: 'holt-winters-additive',
    period,
    history,
    forecast: projection,
    metrics: {
      wape: round2(metrics.modelWape * 100),
      baselineWape: round2(metrics.baselineWape * 100),
      mape: round2(metrics.mape * 100),
      improvementPct: round2(metrics.improvement * 100),
      holdoutPoints: metrics.holdout,
      sigma: round2(sigma),
      modelMaeUnits: round2(metrics.modelMae),
      baselineMaeUnits: round2(metrics.baselineMae),
    },
    kpis: {
      weekAheadUnits: Math.round(weekAhead),
      weekAheadDeltaPct: round2(weekDelta * 100),
      previousWeekUnits: Math.round(lastWeekActual),
      growthVsPriorWeekPct:
        previousWeekActual === 0 ? 0 : round2(((lastWeekActual - previousWeekActual) / previousWeekActual) * 100),
      peakDay: projection[peak.index].label,
      peakUnits: projection[peak.index].value,
      modelWape: round2(metrics.modelWape * 100),
      unitsSavedPerDay: round2(unitsSavedPerDay),
      inventorySavingsCop: Math.round(unitsSavedPerDay * 30 * unitMargin),
    },
  }
}

function round2(value) {
  return Math.round(value * 100) / 100
}

module.exports = {
  mulberry32,
  buildSyntheticHistory,
  holtWinters,
  seasonalNaive,
  wape,
  mape,
  backtest,
  buildLabels,
  buildForecastReport,
}
