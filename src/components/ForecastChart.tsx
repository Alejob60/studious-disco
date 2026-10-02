import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useReducedMotion } from 'motion/react'
import { Activity, Sparkles } from 'lucide-react'
import { formatNumber } from '../lib/format'
import type { ChartPoint } from '../lib/forecast-view'
import type { ForecastMetrics } from '../lib/api'
import { Reveal } from './ui/Reveal'
import { useI18n } from '../i18n/I18nProvider'

const AXIS = {
  stroke: '#A1A1AA',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const

type TooltipPayloadItem = {
  dataKey?: string | number
  value?: number | string
  color?: string
}

/** Dark-styled tooltip listing only the series that have a value that day. */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
}) {
  const { t } = useI18n()

  if (!active || !payload?.length) return null

  const rows = payload.filter((item) => typeof item.value === 'number')

  return (
    <div className="rounded-xl border border-line-strong bg-surface/95 px-3.5 py-2.5 shadow-xl shadow-black/50 backdrop-blur">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
      {rows.map((item) => (
        <div key={String(item.dataKey)} className="flex items-center gap-2 text-xs">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-body">
            {item.dataKey === 'real' ? t('chart.reality') : t('chart.prediction')}
          </span>
          <span className="ml-auto pl-4 font-semibold text-white">
            {formatNumber(Number(item.value), 0)} {t('chart.unit')}
          </span>
        </div>
      ))}
    </div>
  )
}

const SERIES = [
  { key: 'real', labelKey: 'chart.reality' },
  { key: 'predicted', labelKey: 'chart.prediction' },
] as const

/** Main comparison chart: what actually happened vs. what the model expects. */
export function ForecastChart({
  points,
  forecastStartIndex,
  metrics,
  peakDay,
  peakUnits,
}: {
  points: ChartPoint[]
  forecastStartIndex: number
  metrics: ForecastMetrics
  peakDay: string
  peakUnits: number
}) {
  const { t } = useI18n()
  const reduceMotion = useReducedMotion()
  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  const toggle = (key: string) => setHidden((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <section
      id="pronostico"
      className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
    >
      <Reveal>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white sm:text-2xl">
              <Activity className="size-5 text-gold" strokeWidth={2} />
              {t('chart.prediction')}
            </h2>
            <p className="mt-1.5 text-sm text-body">{t('kpis.model')}</p>
          </div>

          {/* Legend doubles as a series toggle. */}
          <div className="flex flex-wrap items-center gap-2">
            {SERIES.map((series) => {
              const isHidden = hidden[series.key]
              const isGold = series.key === 'predicted'
              return (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => toggle(series.key)}
                  aria-pressed={!isHidden}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                    isHidden
                      ? 'border-line text-white/30 hover:text-white/60'
                      : isGold
                        ? 'border-gold/40 bg-gold/10 text-gold'
                        : 'border-line-strong bg-surface text-body hover:text-white'
                  }`}
                >
                  <span className={`size-2 rounded-full ${isGold ? 'bg-gold' : 'bg-white/40'}`} />
                  {t(series.labelKey)}
                </button>
              )
            })}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <div className="h-[280px] w-full sm:h-[360px] lg:h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="fillReal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#71717A" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#71717A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillPredicted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />

                <XAxis dataKey="day" {...AXIS} dy={8} minTickGap={12} />
                <YAxis {...AXIS} width={56} />

                <Tooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: 'rgba(212,175,55,0.35)' }}
                />

                {/* Boundary between "what happened" and "what the model expects". */}
                <ReferenceLine
                  x={points[forecastStartIndex]?.day}
                  stroke="rgba(212,175,55,0.45)"
                  strokeDasharray="4 4"
                  label={{
                    value: t('chart.prediction'),
                    position: 'insideTopRight',
                    fill: '#A1A1AA',
                    fontSize: 10,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="real"
                  stroke="#71717A"
                  strokeWidth={2}
                  fill="url(#fillReal)"
                  dot={{ r: 3, fill: '#050505', stroke: '#71717A', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#A1A1AA', stroke: '#050505', strokeWidth: 2 }}
                  hide={hidden.real}
                  isAnimationActive={!reduceMotion}
                  animationDuration={1200}
                />

                <Area
                  type="monotone"
                  dataKey="predicted"
                  stroke="#D4AF37"
                  strokeWidth={2.5}
                  fill="url(#fillPredicted)"
                  dot={{ r: 3, fill: '#050505', stroke: '#D4AF37', strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: '#D4AF37', stroke: '#050505', strokeWidth: 2 }}
                  hide={hidden.predicted}
                  isAnimationActive={!reduceMotion}
                  animationDuration={1200}
                  animationBegin={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-4 text-xs text-body">
            <span className="flex items-center gap-2">
              <Sparkles className="size-3.5 text-gold" />
              {t('chart.peakDetected')}:{' '}
              <strong className="text-gold">
                {peakDay} · {formatNumber(peakUnits, 0)} {t('chart.unit')}
              </strong>
            </span>
            <span>
              {t('chart.backtest', { days: metrics.holdoutPoints })}:{' '}
              <strong className="text-white">{metrics.wape}% WAPE</strong>
              <span className="text-white/40">
                {' '}
                ({t('chart.baseline', { value: metrics.baselineWape })})
              </span>
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  )
}