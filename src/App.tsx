import { lazy, Suspense, useEffect, useRef } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AgentChat } from './components/AgentChat'
import { ContactForm } from './components/ContactForm'
import { DataLab } from './components/DataLab'
import { DataSourceBadge } from './components/DataSourceBadge'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { Hero } from './components/Hero'
import { KpiCards } from './components/KpiCards'
import { ServicesExplainer } from './components/ServicesExplainer'
import { CookieConsent } from './components/legal/CookieConsent'
import { ChartSkeleton } from './components/ui/ChartSkeleton'
import { I18nProvider, isLocale, useI18n } from './i18n/I18nProvider'
import { detectLocale } from './i18n/detectLocale'
import type { Locale } from './i18n/dictionaries'
import { SeoHead } from './components/SeoHead'
import { toChartPoints, toKpis, peakDayLabel } from './lib/forecast-view'
import { trackForecastSource } from './lib/analytics'
import { useForecast } from './lib/useForecast'

const SITE_ORIGIN =
  (import.meta.env.VITE_SITE_ORIGIN as string | undefined) ?? window.location.origin

// Recharts is ~360 kB minified, so the chart is split into its own chunk and
// fetched after the first paint instead of blocking it.
const ForecastChart = lazy(() =>
  import('./components/ForecastChart').then((module) => ({
    default: module.ForecastChart,
  })),
)

/**
 * Keeps scrolling in step with the URL.
 *
 * Two separate bugs made the header links look dead, and the second only became
 * visible after fixing the first.
 *
 * 1. `ScrollToTop` ran `window.scrollTo({top: 0})` on `[pathname]`. A hash-only
 *    navigation changes the location but not the path, and the component remounts
 *    anyway, so the effect fired ~250 ms after the click and cancelled the jump.
 *    Traced in the browser: one programmatic scrollTo, 246 ms after the click.
 *
 * 2. The chart is a 360 kB lazy chunk. Clicking a nav link a second or two after
 *    load means the document is still short, so the browser cannot scroll to a
 *    section that does not exist yet — and it does not retry once the content
 *    arrives. The hash is set, the target is later found at the right offset, and
 *    the page never moves. Measured: `#contacto` at 4447 with a document only
 *    5025 tall and a 900 px viewport, i.e. beyond the end of the page.
 *
 * So the hash is honoured explicitly, and the jump is retried until the target is
 * actually reachable. Without the retry, a fast click on a slow connection lands
 * nowhere and the link reads as broken.
 */
function ScrollManager() {
  const { pathname, hash } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

    if (!hash) {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
      return
    }

    const id = hash.slice(1)

    // Bounded: a hash that matches nothing must not spin forever, and a page that
    // never settles must not keep scrolling after the user has taken over.
    let attempts = 0
    let lastHeight = -1
    let frame = 0

    const jump = () => {
      const target = document.getElementById(id)
      if (!target) return false

      const offset = target.getBoundingClientRect().top + window.scrollY
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight

      // Only scroll once the target is genuinely reachable. Scrolling to a
      // position the document cannot reach is what silently did nothing before.
      if (offset > maxScroll + 1) return false

      // 'start' plus the scroll-margin in index.css clears the sticky header, so
      // the section heading is not hidden underneath it.
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return true
    }

    const tick = () => {
      attempts += 1

      if (jump()) return
      if (attempts > 40) return

      const height = document.documentElement.scrollHeight
      if (height === lastHeight) return

      lastHeight = height
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [pathname, hash])

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
  const { locale } = useI18n()
  const { data, source, loading, warning } = useForecast()
  const { points, forecastStartIndex } = toChartPoints(data, locale)
  const kpis = toKpis(data, locale)

  // Report the data provenance once per load. A session recorded as `mock` means
  // the dashboard fell back to bundled data, which must be visible in GA4.
  useEffect(() => {
    if (!loading) trackForecastSource(source)
  }, [loading, source])

  return (
    <>
      <Hero badge={<DataSourceBadge source={source} loading={loading} warning={warning} />} />
      <KpiCards kpis={kpis} />
      <Suspense fallback={<ChartSkeleton />}>
        <ForecastChart
          points={points}
          forecastStartIndex={forecastStartIndex}
          metrics={data.metrics}
          peakDay={peakDayLabel(data, locale)}
          peakUnits={data.kpis.peakUnits}
        />
    </Suspense>
<ServicesExplainer />
    <AgentChat live={source === 'live'} />
      <DataLab />
      <ContactForm />
    </>
  )
}

const LegalPage = lazy(() => import('./pages/LegalPage').then((m) => ({ default: m.LegalPage })))

/**
 * Wraps a locale-scoped route so the language always resolves before children
 * render. Without this, a deep link such as `/en/terms` would briefly flash the
 * Spanish dictionary.
 *
 * `fallbackLocale` covers the unprefixed `/` entry point. It is rendered
 * directly rather than redirected to `/{locale}` so that refreshing the site root
 * always returns the app, even on a host with no SPA rewrite rule configured.
 */
function LocaleRoute({
  children,
  fallbackLocale,
}: {
  children: React.ReactNode
  fallbackLocale?: Locale
}) {
  const { lang } = useParams<{ lang: string }>()
  // An explicit prefix wins over detection, so neither a shared deep link nor
  // the language switcher can be overridden by the browser's preference.
  const locale = fallbackLocale ?? (isLocale(lang) ? lang : null)

  // Only reachable for an explicit but unsupported prefix such as `/fr`.
  if (!locale) return <Navigate to={`/${detectLocale()}`} replace />

  return (
    <I18nProvider locale={locale}>
      <DocumentLang />
      <ScrollManager />
      <SeoHead origin={SITE_ORIGIN} />
      <Header />
      <main id="main">{children}</main>
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
          {/* The unprefixed root renders in place instead of redirecting, so a
              refresh on `/` can never land on a 404. Its language comes from the
              browser, because the demo is opened by people who do not read
              Spanish and an explicit prefix always overrides this. */}
          <Route
            path="/"
            element={
              <LocaleRoute fallbackLocale={detectLocale()}>
                <Landing />
              </LocaleRoute>
            }
          />
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
