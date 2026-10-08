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
 * This is not where the header's anchored links are handled — that lives in
 * `src/lib/anchors.ts`, because the header needs it and App renders the header.
 *
 * What remains here is the part a router effect is genuinely good at: resetting
 * to the top when the path changes, so switching language or following a link to
 * another route does not leave the reader halfway down the old page.
 *
 * The first-render guard matters and is not removable. Without it a deep link
 * such as `/en#terms` would load and then be yanked to the top, which is how it
 * behaved before: the anchor was applied by the browser, then this effect
 * cancelled it.
 */
function ScrollManager() {
  const { pathname } = useLocation()
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }

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
      <AgentChatWithExamples live={source === 'live'} />
      <DataLab />
      <ContactForm />
</>
  )
}

/**
 * Split view: example questions on the left, agent chat on the right.
 * Desktop: 50/50. Mobile: stacked (examples first, chat below).
 */
function AgentChatWithExamples({ live }: { live: boolean }) {
  const { t, dict } = useI18n()

  return (
    <div id="agente" className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 overflow-x-hidden">
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <div className="w-full min-w-0 space-y-4 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
              <span className="grid size-8 place-items-center rounded-lg border border-gold/30 bg-gold/10">
                <span className="text-gold">?</span>
              </span>
              {t('chat.examplesTitle')}
            </h3>
            <p className="mt-2 text-sm text-body">{t('chat.examplesSubtitle')}</p>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gold mb-2">{t('chat.examplesSimple')}</h4>
                <ul className="space-y-2" role="list">
                  {dict.chat.examples.simple.map((ex, i) => (
                    <li key={i} className="rounded-lg border border-line bg-surface-2/60 p-3">
                      <p className="text-sm font-medium text-white">«{ex.q}»</p>
                      <p className="mt-1 text-xs text-body">{ex.a}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gold mb-2">{t('chat.examplesAdvanced')}</h4>
                <ul className="space-y-2" role="list">
                  {dict.chat.examples.advanced.map((ex, i) => (
                    <li key={i} className="rounded-lg border border-line bg-surface-2/60 p-3">
                      <p className="text-sm font-medium text-white">«{ex.q}»</p>
                      <p className="mt-1 text-xs text-body">{ex.a}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-aws/30 bg-aws-bg/50 p-4 text-sm text-aws">
            <p className="font-medium mb-1">{t('chat.examplesNoteTitle')}</p>
            <p>{t('chat.examplesNote')}</p>
          </div>
        </div>

        <div className="min-w-0">
          <AgentChat live={live} />
        </div>
      </div>
    </div>
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
