import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AgentChat } from './components/AgentChat'
import { ContactForm } from './components/ContactForm'
import { DataSourceBadge } from './components/DataSourceBadge'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { KpiCards } from './components/KpiCards'
import { CookieConsent } from './components/legal/CookieConsent'
import { ChartSkeleton } from './components/ui/ChartSkeleton'
import { I18nProvider, isLocale, useI18n } from './i18n/I18nProvider'
import { toChartPoints, toKpis } from './lib/forecast-view'
import { useForecast } from './lib/useForecast'

// Recharts is ~360 kB minified, so the chart is split into its own chunk and
// fetched after the first paint instead of blocking it.
const ForecastChart = lazy(() =>
  import('./components/ForecastChart').then((module) => ({
    default: module.ForecastChart,
  })),
)

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

/** Keeps `<html lang>` accurate so screen readers and search engines follow. */
function DocumentLang() {
  const { locale } = useI18n()
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])
  return null
}

function Landing() {
  const { data, source, loading, warning } = useForecast()
  const { points, forecastStartIndex } = toChartPoints(data)
  const kpis = toKpis(data)

  return (
    <>
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
      <ContactForm />
    </>
  )
}

const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })))

/**
 * Wraps a locale-scoped route so the language always resolves before children
 * render. Without this, a deep link such as `/en/terms` would briefly flash the
 * Spanish dictionary.
 */
function LocaleRoute({ children }: { children: React.ReactNode }) {
  const { lang } = useParams<{ lang: string }>()

  if (!isLocale(lang)) return <Navigate to="/es" replace />

  return (
    <I18nProvider locale={lang}>
      <DocumentLang />
      <ScrollToTop />
      <Header />
      <main>{children}</main>
      <Footer />
      <CookieConsent />
    </I18nProvider>
  )
}

function NotFound() {
  const { lang } = useParams<{ lang: string }>()
  const locale = isLocale(lang) ? lang : 'es'
  return <Navigate to={`/${locale}`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="relative min-h-screen">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-60 focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
        >
          Skip to content
        </a>

        <Routes>
          <Route path="/" element={<Navigate to="/es" replace />} />
          <Route
            path="/:lang"
            element={
              <LocaleRoute>
                <Landing />
              </LocaleRoute>
            }
          />
          <Route
            path="/:lang/:slug"
            element={
              <LocaleRoute>
                <Suspense fallback={<div className="min-h-screen" />}>
                  <LegalPage />
                </Suspense>
              </LocaleRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}