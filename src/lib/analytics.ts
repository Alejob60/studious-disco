/**
 * Google Analytics 4 integration.
 *
 * Analytics is opt-in: without `VITE_GA4_ID` every function here is a no-op, so
 * the site ships no third-party script and stays inside the consent promise made
 * in the cookie policy until an ID is configured.
 *
 * To enable: add `VITE_GA4_ID=G-XXXXXXXXXX` to `.env.production` (or as an
 * Amplify environment variable). Do not add it without also updating
 * `src/content/legal.ts`, because the cookie policy currently states that no
 * analytics are used.
 */

const GA4_ID = (import.meta.env.VITE_GA4_ID as string | undefined)?.trim()

export const analyticsEnabled = Boolean(GA4_ID && /^G-[A-Z0-9]+$/.test(GA4_ID))

let initialised = false

/** Injects the gtag script once, lazily, after consent. */
function ensureLoaded() {
  if (!analyticsEnabled || initialised || typeof window === 'undefined') return
  initialised = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`
  document.head.appendChild(script)

  const layer = (window.dataLayer = window.dataLayer ?? [])
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    layer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', GA4_ID, { send_page_view: false })
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

/**
 * Records a page view.
 *
 * SPA route changes are tracked by the caller (we listen to the router) because
 * GA4's automatic history change detection would double-count our manual sends.
 */
export function trackPageView(path: string, title: string, language: string) {
  if (!analyticsEnabled) return
  ensureLoaded()

  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: title,
    page_location: window.location.href,
    page_language: language,
    // Lets GA4 report on the product language without a custom dimension setup.
    custom_map: { dimension1: 'language' },
  })
}

/** Typed events. Keep names stable: renaming one breaks historical reports. */
export type AnalyticsEvent =
  | { name: 'lead_form_start' }
  | { name: 'lead_form_submit'; locale: string; interests: string[] }
  | { name: 'lead_form_success'; emailed: boolean }
  | { name: 'lead_form_error'; reason: string }
  | { name: 'agent_message_sent'; locale: string }
  | { name: 'agent_action_executed'; action: string; channel?: string }
  | { name: 'language_switched'; from: string; to: string }
  | { name: 'cookie_consent'; choice: 'all' | 'essential' }
  | { name: 'forecast_source'; source: 'live' | 'mock' }
  // The real-data lab. `persisted` is the interesting one: it separates a session
  // that measured a series from one that also recorded it.
  | { name: 'sample_csv_downloaded'; locale: string; sample: 'clean' | 'rough' }
  | { name: 'csv_uploaded'; size: number; locale: string }
  | { name: 'evaluation_completed'; points: number; persisted: boolean; locale: string }

export function trackEvent(event: AnalyticsEvent) {
  if (!analyticsEnabled) return
  ensureLoaded()

  const { name, ...params } = event
  window.gtag?.('event', name, params)
}

/**
 * Reports whether the numbers on screen came from the live API.
 *
 * High-signal for judging: a session where `forecast_source` is `mock` means the
 * dashboard fell back to bundled data, which must be visible in any analysis.
 */
export function trackForecastSource(source: 'live' | 'mock') {
  trackEvent({ name: 'forecast_source', source })
}
