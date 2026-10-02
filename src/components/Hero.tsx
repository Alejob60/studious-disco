import { motion, useReducedMotion } from 'motion/react'
import { ArrowRight, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/I18nProvider'

/** Above-the-fold pitch: value proposition + primary call to action. */
export function Hero({ badge }: { badge?: ReactNode }) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()

  const rise = (delay: number) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  return (
    <section id="top" className="relative mx-auto max-w-7xl px-4 pb-8 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <motion.span
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-3.5 py-1.5 text-xs font-medium text-gold"
          >
            <Sparkles className="size-3.5" strokeWidth={2} />
            {t('hero.badge')}
          </motion.span>

          {badge}
        </div>

        <motion.h1
          {...rise(0.1)}
          className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl"
        >
          {t('hero.titleLead')}{' '}
          <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">
            {t('hero.titleAccent')}
          </span>
        </motion.h1>

        <motion.p
          {...rise(0.2)}
          className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-body sm:text-lg"
        >
          {t('hero.subtitle')}
        </motion.p>

        <motion.div
          {...rise(0.3)}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
        >
          <motion.a
            href="#pronostico"
            whileHover={reduceMotion ? undefined : { scale: 1.03, y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-light px-7 py-3.5 text-sm font-semibold text-black shadow-lg shadow-gold/20 transition-shadow hover:shadow-xl hover:shadow-gold/30 sm:w-auto"
          >
            {t('hero.cta')}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-1"
              strokeWidth={2.5}
            />
          </motion.a>

          <a
            href="#agente"
            className="inline-flex w-full items-center justify-center rounded-xl border border-line-strong px-7 py-3.5 text-sm font-medium text-white transition-colors hover:border-gold/40 hover:bg-gold/5 sm:w-auto"
          >
            {t('hero.ctaSecondary')}
          </a>
        </motion.div>

        <motion.ul
          {...rise(0.4)}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-body"
        >
          {['hero.trust.0', 'hero.trust.1', 'hero.trust.2'].map((key) => (
            <li key={key} className="flex items-center gap-2">
              <span className="size-1 rounded-full bg-gold" />
              {t(key)}
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}