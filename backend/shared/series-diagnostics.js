'use strict'

/**
 * Data-quality diagnostics for an uploaded demand series.
 *
 * This exists because the failure mode is silent. A real retailer's export
 * contains days when the shelf was empty and nothing was sold, days the store was
 * shut, and promotions nobody told us about. Feed those straight to the model and
 * it learns "zero on the 14th" as low demand, then under-forecasts forever. No
 * error is raised and the WAPE still looks respectable.
 *
 * So the series is inspected before it is modelled, and what was found is reported
 * alongside the measurement. Nothing is imputed. A number we flag is a number the
 * reader can act on; a number we quietly fix is a number nobody can check.
 */

/** A run of this many zero days is very unlikely to be genuine zero demand. */
const STOCK_OUT_MIN_RUN = 2

/** |z-score| above this is called out as a possible promotion or anomaly. */
const OUTLIER_Z = 3

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

/**
 * Inspects a numeric series.
 *
 * @param {number[]} series validated, oldest first
 * @param {{ dates?: string[] }} [meta] ISO dates, when the file carried them
 */
function analyseSeries(series, meta = {}) {
  const findings = []
  const dates = Array.isArray(meta.dates) ? meta.dates : null

  const values = Array.isArray(series) ? series : []
  const stats = basicStats(values)

  // Zero runs. One empty day is plausible; a run of them is not demand.
  const zeroRuns = []
  let runStart = -1
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === 0) {
      if (runStart === -1) runStart = i
    } else if (runStart !== -1) {
      zeroRuns.push({ start: runStart, length: i - runStart })
      runStart = -1
    }
  }
  if (runStart !== -1) zeroRuns.push({ start: runStart, length: values.length - runStart })

  const longestZeroRun = zeroRuns.reduce((max, run) => Math.max(max, run.length), 0)
  const suspectedStockOuts = zeroRuns.filter((run) => run.length >= STOCK_OUT_MIN_RUN)

  if (suspectedStockOuts.length > 0) {
    const lostDays = suspectedStockOuts.reduce((sum, run) => sum + run.length, 0)
    findings.push({
      code: 'possible_stock_out',
      severity: 'high',
      // Named rather than numbered: "point 47" means nothing to a retail manager
      // on Monday morning.
      when: describeRanges(suspectedStockOuts.map((r) => r.start), dates),
      detail: `${lostDays} day${lostDays === 1 ? '' : 's'} recorded as zero in a row. That is usually an empty shelf or a closed store, not zero demand. Left as zero, the model learns those days are quiet and under-forecasts.`,
      days: lostDays,
    })
  }

  // Calendar gaps. Only possible when the file carried dates.
  const missingDays = dates ? findMissingDays(dates) : null
  if (missingDays && missingDays.length > 0) {
    findings.push({
      code: 'missing_days',
      severity: 'medium',
      when: missingDays.slice(0, 5).map((d) => d),
      detail: `The calendar jumps: ${missingDays.length} day${missingDays.length === 1 ? '' : 's'} missing between the first and last date. The series was read as one unbroken run, so those gaps count as consecutive observations.`,
      days: missingDays.length,
    })
  }

  // Promotions and anomalies.
  const outliers = stats.stdDev > 0 ? findOutliers(values, stats.mean, stats.stdDev) : []
  if (outliers.length > 0) {
    findings.push({
      code: 'outliers',
      severity: 'low',
      when: outliers.slice(0, 5).map((i) => describePoint(i, dates)),
      detail: `${outliers.length} point${outliers.length === 1 ? '' : 's'} sit more than ${OUTLIER_Z} standard deviations out. Usually a promotion or a bulk order; the forecast has no way to anticipate it.`,
      days: outliers.length,
    })
  }

  // Series that cannot support a seasonal fit.
  if (stats.max === stats.min) {
    findings.push({
      code: 'constant_series',
      severity: 'high',
      when: [],
      detail: 'Every day is the same number. There is nothing to forecast and no seasonality to find, so the comparison below is not meaningful.',
      days: values.length,
    })
  }

  const zeroShare = values.length > 0 ? round2((values.filter((v) => v === 0).length / values.length) * 100) : 0

  return {
    points: values.length,
    stats: {
      min: stats.min,
      max: stats.max,
      mean: stats.mean,
      median: stats.median,
      stdDev: stats.stdDev,
      // Above roughly 0.6 a daily retail series is noisy enough that any
      // forecast carries real uncertainty; useful context for reading the WAPE.
      coefficientOfVariation: stats.mean > 0 ? round2(stats.stdDev / stats.mean) : null,
      zeroSharePct: zeroShare,
    },
    longestZeroRun,
    suspectedStockOutDays: suspectedStockOuts.reduce((sum, run) => sum + run.length, 0),
    missingCalendarDays: missingDays ? missingDays.length : null,
    // The headline: whether the measurement below can be trusted as-is.
    reliable: findings.every((finding) => finding.severity !== 'high'),
    findings,
  }
}

function basicStats(values) {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, stdDev: 0 }
  }

  const sum = values.reduce((a, b) => a + b, 0)
  const mean = sum / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: round2(mean),
    median: round2(median),
    stdDev: round2(Math.sqrt(variance)),
  }
}

function findOutliers(values, mean, stdDev) {
  const found = []
  for (let i = 0; i < values.length; i += 1) {
    if (Math.abs((values[i] - mean) / stdDev) > OUTLIER_Z) found.push(i)
  }
  return found
}

/**
 * Walks the dates and reports the calendar days that are not present.
 *
 * Returns the first gap day of each run rather than every missing day, so a long
 * export does not produce an unusable message.
 */
function findMissingDays(dates) {
  const gaps = []
  for (let i = 1; i < dates.length; i += 1) {
    const previous = parseIso(dates[i - 1])
    const current = parseIso(dates[i])
    if (!previous || !current) continue

    const expected = new Date(previous)
    expected.setDate(expected.getDate() + 1)

    if (expected.getTime() !== current.getTime()) {
      const days = Math.round((current - expected) / 86400000)
      // Bounded: a file sorted the wrong way or two unrelated ranges produces
      // nonsense arithmetic, and reporting 40,000 missing days helps nobody.
      if (days > 0 && days < 400) gaps.push(dates[i])
    }
  }
  return gaps
}

function parseIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function describePoint(index, dates) {
  return dates && dates[index] ? dates[index] : `day ${index + 1}`
}

/** Collapses consecutive indices into readable ranges: "3–5 Oct, 12 Oct". */
function describeRanges(starts, dates) {
  if (!dates) return starts.slice(0, 5).map((i) => `day ${i + 1}`)
  return starts.slice(0, 5).map((i) => dates[i] ?? `day ${i + 1}`)
}

module.exports = {
  analyseSeries,
  findMissingDays,
  basicStats,
  STOCK_OUT_MIN_RUN,
  OUTLIER_Z,
}