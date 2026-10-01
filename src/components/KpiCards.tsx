import { motion, useReducedMotion } from 'motion/react'
import { ArrowDownRight, ArrowUpRight, Info } from 'lucide-react'
import { Reveal } from './ui/Reveal'
import { useCountUp } from '../lib/useCountUp'
import { formatDelta, formatNumber } from '../lib/format'
import { KPIS, type Kpi } from '../data/mock'

/** One KPI tile. Isolated so the count-up animation owns a single ref. */
function KpiCard({ kpi, index }: { kpi: Kpi; index: number }) {
  const reduceMotion = useReducedMotion()
  const { ref, value } = useCountUp(kpi.value, kpi.decimals)

  // A drop in costs is good, so the arrow colour depends on `higherIsBetter`.
  const positive = kpi.delta > 0
  const isGood = kpi.higherIsBetter ? positive : !positive
  const TrendIcon = positive ? ArrowUpRight : ArrowDownRight

  return (
    <motion.article
      initial={reduceMotion ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -4 }}
      className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-gold/30"
    >
      {/* Gold wash revealed on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gold/0 via-gold/0 to-gold/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-medium text-body">
          {kpi.label}
          <span title={kpi.hint} className="text-white/25 transition-colors group-hover:text-gold/60">
            <Info className="size-3.5" />
          </span>
        </h3>
      </div>

      <p className="relative mt-4 flex items-baseline gap-0.5 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        {kpi.prefix && <span className="text-lg text-gold">{kpi.prefix}</span>}
        <span ref={ref}>{formatNumber(value, kpi.decimals)}</span>
        {kpi.suffix && <span className="text-base font-medium text-body">{kpi.suffix}</span>}
      </p>

      <p
        className={`relative mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
          isGood ? 'bg-gold/10 text-gold' : 'bg-red-500/10 text-red-400'
        }`}
      >
        <TrendIcon className="size-3.5" strokeWidth={2.5} />
        {formatDelta(kpi.delta, Number.isInteger(kpi.delta) ? 0 : 1)}
        <span className="text-body">vs. periodo anterior</span>
      </p>
    </motion.article>
  )
}

/** The three headline metrics directly under the hero. */
export function KpiCards() {
  return (
    <section id="kpis" className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Reveal className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-body">
          Indicadores clave
        </h2>
        <span className="text-xs text-white/30">Datos simulados · últimos 14 días</span>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPIS.map((kpi, i) => (
          <KpiCard key={kpi.id} kpi={kpi} index={i} />
        ))}
      </div>
    </section>
  )
}