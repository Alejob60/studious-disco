import { motion, useReducedMotion } from 'motion/react'
import { Activity, Gauge, LineChart, ShieldCheck, Zap } from 'lucide-react'
import { Reveal } from './ui/Reveal'
import { useI18n } from '../i18n/I18nProvider'

/** Icon per layer, in the same order as the dictionary items. */
const LAYER_ICONS = [Zap, Activity, Gauge] as const

/**
 * Explains what the product actually is.
 *
 * The dashboard shows the output; this section answers the question the chart
 * cannot: which service produced this number, what it costs to run, and what
 * happens when part of it breaks. Every figure here is the same one the API
 * returns and the benchmark reproduces, so nothing on this section is decorative.
 */
export function ServicesExplainer() {
  const { t, dict } = useI18n()
  const reduceMotion = useReducedMotion()

  // Arrays come from `dict`, not `t()`: the resolver only returns strings, so
  // asking it for 'services.items' would yield undefined.
  const items = dict.services.items
  const points = dict.services.winner.points

  return (
    <section id="servicios" className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Reveal className="mb-8">
        <p className="flex items-center gap-2 text-xs font-medium text-gold">
          <LineChart className="size-3.5" strokeWidth={2} />
          {t('services.badge')}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white sm:text-3xl">{t('services.title')}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-body">{t('services.subtitle')}</p>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item, index) => {
          const Icon = LAYER_ICONS[index] ?? LineChart
          return (
            <motion.article
              key={item.name}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={reduceMotion ? undefined : { y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-gold/30"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/0 via-gold/0 to-gold/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-line-strong bg-surface-2">
                    <Icon className="size-4 text-gold" strokeWidth={2} />
                  </span>
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-body">
                    {item.tag}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-semibold text-white">{item.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-body">{item.what}</p>
                <p className="mt-3 text-sm leading-relaxed text-body/80">{item.how}</p>

                <p className="mt-4 border-t border-line pt-3 text-xs font-medium text-gold">{item.proof}</p>
              </div>
            </motion.article>
          )
        })}
      </div>

      <Reveal delay={0.12} className="mt-6">
        <div className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
            <ShieldCheck className="size-5 text-gold" strokeWidth={2} />
            {t('services.winner.title')}
          </h3>

          <dl className="mt-5 grid gap-5 sm:grid-cols-2">
            {points.map((point) => (
              <div key={point.head}>
                <dt className="text-sm font-medium text-white">{point.head}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-body">{point.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Reveal>
    </section>
  )
}