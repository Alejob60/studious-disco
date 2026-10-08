import { useI18n } from './I18nProvider'
import { trackEvent } from '../lib/analytics'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Language switcher that swaps the leading path segment.
 *
 * Switching is a client-side navigation, so it works even when Amplify has no
 * rewrite rule configured for deep links.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { locale, locales } = useI18n()
  const navigate = useNavigate()
  const location = useLocation()

  const switchTo = (next: string) => {
    trackEvent({ name: 'language_switched', from: locale, to: next })
    const segments = location.pathname.split('/').filter(Boolean)
    if (segments.length === 0 || !['es', 'en'].includes(segments[0])) {
      segments.unshift(next)
    } else {
      segments[0] = next
    }
    navigate(`/${segments.join('/')}${location.search}${location.hash}`)
  }

  return (
    <div
      className={`flex items-center rounded-full border border-line bg-surface p-0.5 ${className}`}
      role="group"
      aria-label="Language / Idioma"
    >
      {locales.map((entry) => {
        const isActive = entry.locale === locale
        return (
<button
            key={entry.locale}
            type="button"
            onClick={() => switchTo(entry.locale)}
            aria-current={isActive ? 'true' : undefined}
            // 44px tall on touch. The pill was 25px, which is below the minimum a
            // thumb can reliably hit, and the language switcher is one of the
            // first things a judge on a phone will try.
            className={`min-h-11 min-w-11 rounded-full px-3 text-[11px] font-semibold transition-colors sm:min-h-0 sm:min-w-0 sm:py-1 ${
              isActive
                ? 'bg-gradient-to-r from-gold to-gold-light text-black'
                : 'text-body hover:text-white'
            }`}
          >
            {entry.short}
          </button>
        )
      })}
    </div>
  )
}
