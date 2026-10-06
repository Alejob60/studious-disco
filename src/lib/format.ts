/** Formats a number with the es-CO convention (dot as thousands separator). */
export function formatNumber(value: number, decimals = 0, locale: 'es' | 'en' = 'es') {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Formats a signed percentage change, always showing the sign. */
export function formatDelta(delta: number, decimals = 1, locale: 'es' | 'en' = 'es') {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatNumber(delta, decimals, locale)}%`
}

/**
 * Parses an ISO `YYYY-MM-DD` as a *local* calendar date.
 *
 * `new Date('2026-09-16')` is parsed as UTC midnight, which in any timezone west
 * of Greenwich is the previous day. A forecast labelled one day off is worse than
 * an unlabelled one, so the components are read directly.
 */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

/**
 * Renders a short weekday label in the reader's language.
 *
 * The API sends both `label` and `date`, and `label` is always in Spanish: the
 * backend formats it with one fixed weekday table. Sending the ISO date as well
 * is what lets the interface render "Wed 14" without a second request, and the
 * Spanish copy stays correct because it is formatted in Spanish.
 */
export function formatDayLabel(iso: string, locale: 'es' | 'en'): string {
  const date = parseIsoDate(iso)
  if (!date) return iso

  const weekday = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    weekday: 'short',
  }).format(date)

  // `es-CO` abbreviates to "mié", which is correct; some locales yield a trailing
  // period ("mié.") that reads as noise next to the day number.
  return `${weekday.replace(/\.$/, '')} ${date.getDate()}`
}

/** Full weekday and date, for a peak day that deserves the space. */
export function formatDayLong(iso: string, locale: 'es' | 'en'): string {
  const date = parseIsoDate(iso)
  if (!date) return iso

  const weekday = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    weekday: 'long',
  }).format(date)

  return `${weekday} ${date.getDate()}`
}