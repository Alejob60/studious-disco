import { useEffect, useState } from 'react'
import { fetchForecast, isApiConfigured, type ForecastResponse, type ForecastSource } from './api'
import { buildMockForecast } from '../data/mock'

type ForecastState = {
  data: ForecastResponse
  source: ForecastSource
  loading: boolean
  /** Set when the live call failed and mock data is standing in. */
  warning: string | null
}

/**
 * Loads the forecast from the API, falling back to the bundled mock payload.
 *
 * The fallback is deliberate: a judge opening the page on conference wifi must
 * still see a working dashboard, and the source badge tells them which it is.
 */
export function useForecast(): ForecastState {
  const [state, setState] = useState<ForecastState>(() => ({
    data: buildMockForecast(),
    source: 'mock',
    loading: isApiConfigured,
    warning: null,
  }))

  useEffect(() => {
    if (!isApiConfigured) {
      setState({ data: buildMockForecast(), source: 'mock', loading: false, warning: null })
      return
    }

    const controller = new AbortController()
    let active = true

    fetchForecast(controller.signal)
      .then((data) => {
        if (!active) return
        setState({ data, source: 'live', loading: false, warning: null })
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return
        setState({
          data: buildMockForecast(),
          source: 'mock',
          loading: false,
          warning: `API no disponible (${describeError(error)}). Mostrando datos de demostración.`,
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [])

  return state
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message
  return 'error desconocido'
}