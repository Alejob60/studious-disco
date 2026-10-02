/**
 * Shapes the API payload into what the chart and KPI cards consume, and builds
 * an equivalent payload from the bundled mock data so the dashboard has a
 * single rendering path regardless of where the numbers came from.
 */

import type { ForecastResponse } from './api'

/** One x-axis slot. `real` and `predicted` overlap on the boundary day. */
export type ChartPoint = {
  day: string
  real: number | null
  predicted: number | null
  lower: number | null
  upper: number | null
}

export type DisplayKpi = {
  id: string
  label: string
  value: number
  prefix?: string
  suffix?: string
  decimals: number
  /** Omitted when there is no honest period-over-period comparison to show. */
  delta?: number
  higherIsBetter?: boolean
  hint: string
}

/** How many historical days to plot before the forecast window starts. */
const HISTORY_WINDOW = 21

export function toChartPoints(data: ForecastResponse): {
  points: ChartPoint[]
  forecastStartIndex: number
} {
  const history = data.history.slice(-HISTORY_WINDOW)

  const points: ChartPoint[] = history.map((point) => ({
    day: point.label,
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
      day: point.label,
      real: index < boundary ? lastReal : null,
      predicted: point.value,
      lower: point.lower,
      upper: point.upper,
    })
  })

  return { points, forecastStartIndex: points.length - data.forecast.length - 1 }
}

export function toKpis(data: ForecastResponse): DisplayKpi[] {
  const { kpis, metrics } = data
  const cop = (value: number) =>
    new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)

  return [
    {
      id: 'demand',
      label: 'Demanda predicha (7 días)',
      value: kpis.weekAheadUnits,
      suffix: 'unid.',
      decimals: 0,
      delta: kpis.weekAheadDeltaPct,
      higherIsBetter: true,
      hint: `Suma del pronóstico frente a ${cop(kpis.previousWeekUnits)} unidades reales de la semana en curso.`,
    },
    {
      id: 'savings',
      label: 'Ahorro en reposición (30 días)',
      value: kpis.inventorySavingsCop,
      prefix: '$',
      decimals: 0,
      hint: `Backtest: el modelo comete ${metrics.modelMaeUnits} unidades/día de error frente a ${metrics.baselineMaeUnits} del baseline estacional, a un margen de $18.500 COP por unidad.`,
    },
    {
      id: 'accuracy',
      label: 'Precisión del modelo (WAPE)',
      value: metrics.wape,
      suffix: '%',
      decimals: 2,
      hint: `Validado sobre ${metrics.holdoutPoints} días retenidos. Baseline estacional: ${metrics.baselineWape}% → modelo: ${metrics.wape}% (${metrics.improvementPct}% mejor).`,
    },
  ]
}