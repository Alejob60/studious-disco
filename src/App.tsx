import { lazy, Suspense } from 'react'
import { AgentChat } from './components/AgentChat'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { KpiCards } from './components/KpiCards'
import { ChartSkeleton } from './components/ui/ChartSkeleton'

// Recharts is ~400 kB minified, so the chart is split into its own chunk and
// fetched after the first paint instead of blocking it.
const ForecastChart = lazy(() =>
  import('./components/ForecastChart').then((module) => ({
    default: module.ForecastChart,
  })),
)

/**
 * Single-page dashboard for the hackathon demo.
 *
 * Sections are stacked in reading order: header → hero → KPIs → forecast chart →
 * agent chat → footer.
 */
export default function App() {
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
        <Hero />
        <KpiCards />
        <Suspense fallback={<ChartSkeleton />}>
          <ForecastChart />
        </Suspense>
        <AgentChat />
      </main>

      <Footer />
    </div>
  )
}