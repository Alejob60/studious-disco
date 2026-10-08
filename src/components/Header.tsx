import { motion, useReducedMotion } from 'motion/react'
import { BrainCircuit, Zap, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'
import { scrollToAnchor } from '../lib/anchors'

/** Sticky top bar: brand on the left, AWS badge and language switch on the right. */
export function Header() {
  const { t, locale } = useI18n()
  const reduceMotion = useReducedMotion()
  const [mobileOpen, setMobileOpen] = useState(false)

  // Deep links such as /en/terms must not keep the anchor scrolled into view.
  const base = `/${locale}`

  const navLinks = [
    { href: `${base}#agente`, label: t('nav.agent') },
    { href: `${base}#pronostico`, label: t('nav.forecast') },
    { href: `${base}#servicios`, label: t('nav.services') },
    { href: `${base}#lab`, label: t('nav.lab') },
    { href: `${base}#contacto`, label: t('nav.contact') },
  ]

  const closeMobile = () => setMobileOpen(false)

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
        <a
          href={`${base}#top`}
          className="-my-2 group flex min-h-11 items-center gap-2.5 py-2 sm:-my-1 sm:py-1"
        >
          <span className="grid size-9 place-items-center rounded-lg border border-gold/30 bg-gold/10 transition-colors group-hover:bg-gold/20">
            <BrainCircuit className="size-5 text-gold" strokeWidth={1.75} />
          </span>
          <span className="text-base font-semibold tracking-tight text-white sm:text-lg">
            Atelier <span className="text-gold">Predict</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden items-center gap-5 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center py-1 text-sm text-body transition-colors hover:text-gold"
              >
                {link.label}
              </a>
            ))}
          </div>

          <LanguageSwitcher />

          <motion.span
            whileHover={reduceMotion ? undefined : { scale: 1.04 }}
            className="hidden sm:flex items-center gap-1.5 rounded-full border border-aws/30 bg-aws-bg px-3 py-1.5 text-[11px] font-medium text-aws"
          >
            <Zap className="size-3.5" strokeWidth={2.5} />
            <span>Powered by AWS</span>
          </motion.span>

          <button
            type="button"
            className="md:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-body hover:text-white transition-colors"
            aria-label={mobileOpen ? t('nav.close') : t('nav.open')}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="size-6" strokeWidth={2} /> : <Menu className="size-6" strokeWidth={2} />}
          </button>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: mobileOpen ? 1 : 0, height: mobileOpen ? 'auto' : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="md:hidden overflow-hidden"
        >
          <div className="flex flex-col gap-2 py-4 border-t border-line">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center px-2 py-1.5 text-sm text-body transition-colors hover:text-gold"
                onClick={closeMobile}
              >
                {link.label}
              </a>
            ))}
          </div>
        </motion.div>
      </nav>
    </motion.header>
  )
}