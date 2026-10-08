import { motion, useReducedMotion } from 'motion/react'
import { BrainCircuit, Zap } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { scrollToAnchor } from '../lib/anchors'

/** Sticky top bar: brand on the left, AWS badge and language switch on the right. */
export function Header() {
  const { t, locale } = useI18n()
  const reduceMotion = useReducedMotion()

  // Deep links such as /en/terms must not keep the anchor scrolled into view.
  const base = `/${locale}`

  return (
    <motion.header
      initial={reduceMotion ? false : { y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="sticky top-0 z-50 border-b border-line bg-ink/70 backdrop-blur-xl"
    >
      <nav
        aria-label="Principal"
        // Anchored links are handled here rather than by the browser. See
        // `scrollToAnchor` in App.tsx: the document is still short while the lazy
        // chart loads, and a plain fragment jump into a section that is not yet
        // there does nothing at all.
        onClick={scrollToAnchor}
        className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8"
      >
        <a href={`${base}#top`} className="group flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg border border-gold/30 bg-gold/10 transition-colors group-hover:bg-gold/20">
            <BrainCircuit className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
            Atelier <span className="text-gold">Predict</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-5 md:flex">
            <a
              href={`${base}#agente`}
              className="text-sm text-body transition-colors hover:text-gold"
            >
              {t('nav.agent')}
            </a>
            <a
              href={`${base}#pronostico`}
              className="text-sm text-body transition-colors hover:text-gold"
            >
              {t('nav.forecast')}
            </a>
            <a
              href={`${base}#servicios`}
              className="text-sm text-body transition-colors hover:text-gold"
            >
              {t('nav.services')}
            </a>
            <a
              href={`${base}#lab`}
              className="text-sm text-body transition-colors hover:text-gold"
            >
              {t('nav.lab')}
            </a>
            <a
              href={`${base}#contacto`}
              className="text-sm text-body transition-colors hover:text-gold"
            >
              {t('nav.contact')}
            </a>
          </div>

          <LanguageSwitcher />

          <motion.span
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            className="flex items-center gap-1.5 rounded-full border border-aws/30 bg-aws-bg px-3 py-1.5 text-[11px] font-medium text-aws"
          >
            <Zap className="size-3.5" strokeWidth={2.5} />
            <span className="hidden sm:inline">Powered by AWS</span>
            <span className="sm:hidden">AWS</span>
          </motion.span>
        </div>
      </nav>
    </motion.header>
  )
}