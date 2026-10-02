import { useI18n } from './I18nProvider'
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
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
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