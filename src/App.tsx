import { lazy, Suspense } from 'react'
import { AgentChat } from './components/AgentChat'
import { DataSourceBadge } from './components/DataSourceBadge'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { KpiCards } from './components/KpiCards'
import { ChartSkeleton } from './components/ui/ChartSkeleton'
import { toChartPoints, toKpis } from './lib/forecast-view'
import { useForecast } from './lib/useForecast'

// Recharts is ~360 kB minified, so the chart is split into its own chunk and
// fetched after the first paint instead of blocking it.
const ForecastChart = lazy(() =>
  import('./components/ForecastChart').then((module) => ({
    default: module.ForecastChart,
  })),
)

/**
 * Single-page dashboard for the hackathon demo.
 *
 * Data flows one way: `useForecast` resolves the API payload (or falls back to
 * the bundled mock of the same shape), and the sections below render whatever
 * they are handed. Nothing branches on the source except the badge.
 */
export default function App() {
  const { data, source, loading, warning } = useForecast()
  const { points, forecastStartIndex } = toChartPoints(data)
  const kpis = toKpis(data)

  return (
    <div className="relative min-h-screen">
      <a
        href="#pronostico"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
      >
        Saltar al contenido
      </a>

      <Header />

      <main>
        <Hero badge={<DataSourceBadge source={source} loading={loading} warning={warning} />} />
        <KpiCards kpis={kpis} />
        <Suspense fallback={<ChartSkeleton />}>
          <ForecastChart
            points={points}
            forecastStartIndex={forecastStartIndex}
            metrics={data.metrics}
            peakDay={data.kpis.peakDay}
            peakUnits={data.kpis.peakUnits}
          />
        </Suspense>
        <AgentChat live={source === 'live'} />
      </main>

      <Footer />
    </div>
  )
}