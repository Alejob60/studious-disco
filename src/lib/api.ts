/**
 * Client for the Atelier Predict serverless API.
 *
 * Every call degrades gracefully: if `VITE_API_URL` is not configured, or the
 * API is unreachable, the dashboard falls back to the bundled mock data so the
 * demo never shows an empty screen. `ForecastSource` is what the UI uses to tell
 * the viewer which of the two they are looking at.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export type ForecastSource = 'live' | 'mock'

export type ForecastPoint = {
  label: string
  date: string
  value: number
}

export type ForecastProjection = ForecastPoint & {
  lower: number
  upper: number
}

export type ForecastMetrics = {
  wape: number
  baselineWape: number
  mape: number
  improvementPct: number
  holdoutPoints: number
  sigma: number
  modelMaeUnits: number
  baselineMaeUnits: number
}

export type ForecastKpis = {
  weekAheadUnits: number
  weekAheadDeltaPct: number
  previousWeekUnits: number
  growthVsPriorWeekPct: number
  peakDay: string
  peakUnits: number
  modelWape: number
  unitsSavedPerDay: number
  inventorySavingsCop: number
}

export type ForecastResponse = {
  generatedAt: string
  dataSource: 'synthetic' | 'provided'
  model: string
  period: number
  history: ForecastPoint[]
  forecast: ForecastProjection[]
  metrics: ForecastMetrics
  kpis: ForecastKpis
}

export type AgentAction = {
  name: string
  input: Record<string, string | number>
  status: string
}

export type ChatResponse = {
  reply: string
  actions: AgentAction[]
  model: string
  usage: { inputTokens: number; outputTokens: number }
}

export const isApiConfigured = Boolean(API_URL)

/** True when the API answered, so callers can label the data source. */
export type FetchResult<T> = { data: T; source: ForecastSource }

/** Matches HISTORY_WINDOW in forecast-view: ask for exactly what the chart draws. */
const HISTORY_WINDOW = 21

export async function fetchForecast(signal?: AbortSignal): Promise<ForecastResponse> {
  if (!API_URL) throw new Error('VITE_API_URL is not set')

  const response = await fetch(`${API_URL}/forecast?window=${HISTORY_WINDOW}`, { signal })
  if (!response.ok) throw new Error(`forecast request failed: ${response.status}`)

  return response.json() as Promise<ForecastResponse>
}

export async function sendChatMessage(
  message: string,
  history: { role: string; content: string }[],
  locale = 'es',
  signal?: AbortSignal,
): Promise<ChatResponse> {
  if (!API_URL) throw new Error('VITE_API_URL is not set')

  const response = await fetch(`${API_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, locale }),
    signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`chat request failed: ${response.status} ${detail}`.trim())
  }

  return response.json() as Promise<ChatResponse>
}

export type EvaluationMetrics = ForecastMetrics

export type EvaluationPersistence = {
  /** Whether a store was configured at all. False means the URI is missing. */
  enabled: boolean
  /** Whether this particular write landed. False while Atlas is unreachable. */
  persisted: boolean
  evaluationId: string | null
  retentionDays: number | null
}

export type EvaluationResponse = {
  ok: true
  evaluatedAt: string
  points: number
  horizon: number
  model: string
  period: number
  metrics: EvaluationMetrics
  kpis: ForecastKpis
  forecast: ForecastProjection[]
  history: ForecastPoint[]
  persistence: EvaluationPersistence
}

/** A refusal from the API, carrying the row-level reason the parser produced. */
export class EvaluationError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EvaluationError'
    this.code = code
  }
}

/**
 * Sends a visitor's own series to be scored.
 *
 * The CSV is sent as text rather than parsed in the browser so the browser and
 * the API agree on one grammar. Parsing twice is how a file that works on the
 * demo silently differs in production.
 */
export async function evaluateSeries(
  csv: string,
  source: string,
  locale = 'es',
  signal?: AbortSignal,
): Promise<EvaluationResponse> {
  if (!API_URL) throw new Error('VITE_API_URL is not set')

  const response = await fetch(`${API_URL}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ csv, source, locale }),
    signal,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload?.ok) {
    throw new EvaluationError(
      payload?.error ?? 'evaluation_failed',
      payload?.message ?? `evaluation failed: ${response.status}`,
    )
  }

  return payload as EvaluationResponse
}