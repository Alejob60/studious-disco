/**
 * Mock dataset for the demo.
 *
 * Everything the dashboard renders is fake on purpose: there is no backend yet,
 * so the numbers are hardcoded here to keep the components purely presentational
 * and make swapping in a real API a one-file change later.
 */

export type ForecastPoint = {
  /** Unique X-axis label, weekday + day of month, e.g. "Lun 01". */
  day: string
  /** Units actually sold. `null` for days we have not lived through yet. */
  real: number | null
  /** Units predicted by the agent. `null` before the forecast horizon starts. */
  predicted: number | null
}

export const FORECAST_POINTS: ForecastPoint[] = [
  { day: 'Lun 01', real: 148, predicted: null },
  { day: 'Mar 02', real: 162, predicted: null },
  { day: 'Mié 03', real: 155, predicted: null },
  { day: 'Jue 04', real: 171, predicted: null },
  { day: 'Vie 05', real: 189, predicted: null },
  { day: 'Sáb 06', real: 205, predicted: null },
  // The boundary day carries both values so the two lines connect seamlessly.
  { day: 'Dom 07', real: 176, predicted: 176 },
  { day: 'Lun 08', real: null, predicted: 184 },
  { day: 'Mar 09', real: null, predicted: 192 },
  { day: 'Mié 10', real: null, predicted: 201 },
  { day: 'Jue 11', real: null, predicted: 248 },
  { day: 'Vie 12', real: null, predicted: 231 },
  { day: 'Sáb 13', real: null, predicted: 214 },
  { day: 'Dom 14', real: null, predicted: 193 },
]

/** Index of the last day with real data — the point where forecasting starts. */
export const FORECAST_START_INDEX = 6

export type Kpi = {
  id: string
  label: string
  value: number
  /** Rendered before the value, e.g. "$". */
  prefix?: string
  /** Rendered after the value, e.g. "unidades" or "%". */
  suffix?: string
  decimals: number
  /** Relative change vs. the previous period, e.g. 12 or -18. */
  delta: number
  /** Whether a positive delta is good (savings going down is good). */
  higherIsBetter: boolean
  hint: string
}

export const KPIS: Kpi[] = [
  {
    id: 'demand',
    label: 'Demanda Predicha (7 días)',
    value: 1240,
    suffix: 'unid.',
    decimals: 0,
    delta: 12,
    higherIsBetter: true,
    hint: 'Suma de la ventana de pronóstico sobre el histórico reciente.',
  },
  {
    id: 'savings',
    label: 'Ahorro en Costos IA',
    value: 450000,
    prefix: '$',
    decimals: 0,
    delta: -18,
    higherIsBetter: false,
    hint: 'Delta de gasto en inference frente al periodo anterior.',
  },
  {
    id: 'conversion',
    label: 'Tasa de Conversión',
    value: 24.5,
    suffix: '%',
    decimals: 1,
    delta: 3.2,
    higherIsBetter: true,
    hint: 'Campañas activadas por el agente que sumaron venta.',
  },
]

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