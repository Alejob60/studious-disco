/**
 * Mock dataset and a `buildMockForecast()` that returns the exact same shape as
 * the live API.
 *
 * Having one rendering path means the fallback demo exercises the real
 * component code; the only difference is which numbers arrive.
 */

import type { ForecastResponse } from '../lib/api'

export type ChatMessage = {
  id: number
  role: 'agent' | 'user'
  text: string
  /** Optional metadata chip rendered under the bubble. */
  meta?: string
}

export const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: 'agent',
    text: 'He analizado tu histórico. Detecto un pico de demanda para el próximo jueves. ¿Activo la campaña de WhatsApp para ese día?',
    meta: 'Confianza del modelo: 87%',
  },
  {
    id: 2,
    role: 'user',
    text: 'Sí, optimiza el envío para maximizar el recaudo.',
  },
  {
    id: 3,
    role: 'agent',
    text: 'Listo. Segmenté 1.842 contactos con alta propensión y programé 3 ventanas de envío (10:00, 16:00 y 20:00) para evitar saturación. Proyección de recaudo adicional: $128.600 COP.',
    meta: 'Campaña programada · WhatsApp',
  },
]

/** Replies used only when the live agent cannot be reached. */
export const SCRIPTED_REPLIES = [
  'Entendido. Ajusté el umbral de reposición al 82% y reservé inventario con el proveedor para cubrir el pico.',
  'Listo. Comparé tres proveedores y el mejor costo por unidad está en el lote del jueves. ¿Autorizas la orden?',
  'Hecho. Dejé la campaña en modo learns y te aviso mañana con el resultado real contra lo proyectado.',
]

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Deterministic PRNG so the demo numbers never change between reloads. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function labels(count: number, endDate: Date, offset = 0) {
  const out: { label: string; date: string; value: number }[] = []
  for (let i = 0; i < count; i += 1) {
    const date = new Date(endDate)
    date.setDate(date.getDate() - (count - 1 - i) + offset)
    const day = String(date.getDate()).padStart(2, '0')
    out.push({
      label: `${DAY_ABBR[date.getDay()]} ${day}`,
      date: formatLocal(date),
      value: 0,
    })
  }
  return out
}

/** Local-time formatting: `toISOString` can shift the calendar day. */
function formatLocal(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Weekly seasonality plus a gentle trend, mirroring the Lambda's generator. */
function mockHistory(days: number, seed = 20260601, base = 150) {
  const random = mulberry32(seed)
  const seasonality = [0.72, 0.94, 0.98, 1.0, 1.06, 1.22, 1.32]
  const today = new Date()

  return labels(days, today).map((entry, index) => {
    const jitter = (random() + random() - 1) * 0.1
    const trend = 1 + index * 0.0022
    const promo = index >= days - 21 && index <= days - 18 ? 1.18 : 1
    const value = base * seasonality[index % 7] * trend * promo * (1 + jitter)
    return { ...entry, value: Math.max(1, Math.round(value)) }
  })
}

/**
 * Builds a full forecast payload locally, matching the API contract.
 *
 * Mirrors the shape the Lambda returns (same `model`, `metrics`, `kpis` keys) so
 * components never branch on the data source.
 */
export function buildMockForecast(): ForecastResponse {
  const history = mockHistory(90)
  const horizon = 14
  const forecastEnd = new Date()
  forecastEnd.setDate(forecastEnd.getDate() + horizon)

  const forecast = labels(horizon, forecastEnd).map((entry, index) => {
    const weekdayIndex = (history.length + index + 1) % 7
    const seasonality = [0.72, 0.94, 0.98, 1.0, 1.06, 1.22, 1.32][weekdayIndex]
    const trend = 1 + (history.length + index) * 0.0022
    const value = Math.round(150 * seasonality * trend)
    return {
      ...entry,
      value,
      lower: Math.max(0, Math.round(value * 0.94)),
      upper: Math.round(value * 1.07),
    }
  })

  const lastSeven = history.slice(-7)
  const weekAheadUnits = forecast.slice(0, 7).reduce((sum, point) => sum + point.value, 0)
  const previousWeekUnits = lastSeven.reduce((sum, point) => sum + point.value, 0)
  const peak = forecast.reduce((best, point) => (point.value > best.value ? point : best), forecast[0])

  return {
    generatedAt: new Date().toISOString(),
    dataSource: 'synthetic',
    model: 'holt-winters-additive',
    period: 7,
    history,
    forecast,
    metrics: {
      wape: 7.77,
      baselineWape: 10.17,
      mape: 8.62,
      improvementPct: 23.61,
      holdoutPoints: 14,
      sigma: 15.28,
      modelMaeUnits: 13.97,
      baselineMaeUnits: 18.29,
    },
    kpis: {
      weekAheadUnits,
      weekAheadDeltaPct: round2(((weekAheadUnits - previousWeekUnits) / previousWeekUnits) * 100),
      previousWeekUnits,
      growthVsPriorWeekPct: 0.48,
      peakDay: peak.label,
      peakUnits: peak.value,
      modelWape: 7.77,
      unitsSavedPerDay: 4.32,
      inventorySavingsCop: 2395611,
    },
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}