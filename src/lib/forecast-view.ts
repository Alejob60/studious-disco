/**
 * Shapes the API payload into what the chart and KPI cards consume, and builds
 * an equivalent payload from the bundled mock data so the dashboard has a
 * single rendering path regardless of where the numbers came from.
 */

import type { ForecastResponse } from './api'
import { UNIT_MARGIN_USD, formatUsd } from './currency'
import { formatDayLabel, formatNumber } from './format'

/** One x-axis slot. `real` and `predicted` overlap on the boundary day. */
export type ChartPoint = {
  day: string
  real: number | null
  predicted: number | null
  lower: number | null
  upper: number | null
}

/**
 * A KPI tile carries dictionary keys, not rendered text.
 *
 * These labels used to be Spanish string literals built here, so the English
 * route showed "Demanda predicha" and "Precisión del modelo". The values are
 * computed here; the words belong to the dictionary.
 */
export type DisplayKpi = {
  id: string
  labelKey: string
  labelVars?: Record<string, string | number>
  hintKey: string
  hintVars?: Record<string, string | number>
  value: number
  prefix?: string
  suffixKey?: string
  decimals: number
  /** Omitted when there is no honest period-over-period comparison to show. */
  delta?: number
  higherIsBetter?: boolean
}

/** How many historical days to plot before the forecast window starts. */
const HISTORY_WINDOW = 21

export function toChartPoints(
  data: ForecastResponse,
  locale: 'es' | 'en',
): {
  points: ChartPoint[]
  forecastStartIndex: number
} {
  const history = data.history.slice(-HISTORY_WINDOW)

  const points: ChartPoint[] = history.map((point) => ({
    day: formatDayLabel(point.date, locale),
    real: point.value,
    predicted: null,
    lower: null,
    upper: null,
  }))

  // The boundary day repeats the last real value so the two areas join cleanly.
  const lastReal = history.at(-1)?.value ?? null
  const boundary = lastReal === null ? 0 : 1

  data.forecast.forEach((point, index) => {
    points.push({
      day: formatDayLabel(point.date, locale),
      real: index < boundary ? lastReal : null,
      predicted: point.value,
      lower: point.lower,
      upper: point.upper,
    })
  })

  return { points, forecastStartIndex: points.length - data.forecast.length - 1 }
}

/**
 * The day the projection peaks, rendered in the reader's language.
 *
 * Derived from the forecast array rather than read from `kpis.peakDay`, because
 * that field is a Spanish label built by the backend from a fixed weekday table.
 */
export function peakDayLabel(data: ForecastResponse, locale: 'es' | 'en'): string {
  const peak = data.forecast.reduce(
    (best, point) => (point.value > (best?.value ?? -Infinity) ? point : best),
    data.forecast[0],
  )
  return peak ? formatDayLabel(peak.date, locale) : ''
}

export function toKpis(data: ForecastResponse, locale: 'es' | 'en'): DisplayKpi[] {
  const { kpis, metrics } = data
  const num = (value: number) => formatNumber(value, 0, locale)

  // The backend sends the margin it actually priced with. Falling back to the
  // shared constant keeps the card correct against an older API rather than
  // showing a total whose own explanation cannot be redone.
  const marginUsd = kpis.unitMarginUsd ?? UNIT_MARGIN_USD

  return [
    {
      id: 'demand',
      labelKey: 'kpis.demandLabel',
      hintKey: 'kpis.demandHint',
      hintVars: { units: num(kpis.previousWeekUnits) },
      value: kpis.weekAheadUnits,
      suffixKey: 'kpis.unit',
      decimals: 0,
      delta: kpis.weekAheadDeltaPct,
      higherIsBetter: true,
    },
    {
      id: 'savings',
      labelKey: 'kpis.savingsLabel',
      hintKey: 'kpis.savingsHint',
      hintVars: {
        modelMae: formatNumber(metrics.modelMaeUnits, 2, locale),
        baselineMae: formatNumber(metrics.baselineMaeUnits, 2, locale),
        margin: formatUsd(marginUsd, locale, 2),
        savedPerDay: formatNumber(kpis.unitsSavedPerDay ?? 0, 2, locale),
        savings: formatUsd(kpis.inventorySavingsUsd ?? 0, locale),
      },
      // Priced in USD, and the hint carries the margin it was priced at, so the
      // arithmetic on the card can be redone without leaving the page.
      value: kpis.inventorySavingsUsd ?? 0,
      suffixKey: 'kpis.usd',
      decimals: 0,
    },
    {
      id: 'accuracy',
      labelKey: 'kpis.accuracyLabel',
      hintKey: 'kpis.accuracyHint',
      hintVars: {
        holdout: metrics.holdoutPoints,
        baseline: formatNumber(metrics.baselineWape, 2, locale),
        model: formatNumber(metrics.wape, 2, locale),
        improvement: formatNumber(metrics.improvementPct, 2, locale),
      },
      value: metrics.wape,
      suffixKey: 'kpis.percent',
      decimals: 2,
    },
  ]
}