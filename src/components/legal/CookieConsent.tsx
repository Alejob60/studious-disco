import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Cookie } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/I18nProvider'
import { slugFromDocId } from '../../content/legal-meta'

const STORAGE_KEY = 'atelier-predict.consent'

type Consent = 'all' | 'essential' | null

function readConsent(): Consent {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === 'all' || raw === 'essential' ? raw : null
  } catch {
    // Private browsing or blocked storage: treat as no answer yet.
    return null
  }
}

function writeConsent(value: Exclude<Consent, null>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Not fatal: the banner simply reappears next visit.
  }
}

/**
 * Cookie consent banner.
 *
 * Honest about scope: the site sets no tracking cookies, only a localStorage
 * preference, so both options behave identically today. The copy says that
 * rather than implying analytics we do not run.
 */
export function CookieConsent() {
  const { t, locale } = useI18n()
  const reduceMotion = useReducedMotion()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Delayed so the banner never competes with the hero animation on load.
    const timer = window.setTimeout(() => setVisible(readConsent() === null), 900)
    return () => window.clearTimeout(timer)
  }, [])

  const decide = (value: Exclude<Consent, null>) => {
    writeConsent(value)
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.aside
          role="dialog"
          aria-modal="false"
          aria-labelledby="cookie-consent-title"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-line-strong bg-surface/95 p-4 shadow-2xl shadow-black/60 backdrop-blur-xl sm:flex-row sm:items-center sm:p-5">
            <span className="hidden size-10 shrink-0 place-items-center rounded-full border border-gold/30 bg-gold/10 sm:grid">
              <Cookie className="size-5 text-gold" strokeWidth={1.75} />
            </span>

            <div className="min-w-0 flex-1">
              <h2 id="cookie-consent-title" className="text-sm font-semibold text-white">
                {t('cookies.title')}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-body sm:text-[13px]">
                {t('cookies.body')}{' '}
                <Link
                  to={`/${locale}/${slugFromDocId('cookies', locale)}`}
                  className="text-gold underline underline-offset-2 hover:text-gold-light"
                >
                  {t('cookies.learnMore')}
                </Link>
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => decide('essential')}
                className="rounded-xl border border-line-strong px-4 py-2.5 text-xs font-medium text-white transition-colors hover:border-gold/40 hover:bg-gold/5"
              >
                {t('cookies.rejectAll')}
              </button>
              <button
                type="button"
                onClick={() => decide('all')}
                className="rounded-xl bg-gradient-to-r from-gold to-gold-light px-4 py-2.5 text-xs font-semibold text-black transition-shadow hover:shadow-lg hover:shadow-gold/25"
              >
                {t('cookies.acceptAll')}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

/** Read by the footer so visitors can change their choice after the fact. */
export function useCookieConsent() {
  const [consent, setConsent] = useState<Consent>(null)

  useEffect(() => {
    setConsent(readConsent())
  }, [])

  const update = (value: Exclude<Consent, null>) => {
    writeConsent(value)
    setConsent(value)
  }

  return { consent, update }
}
