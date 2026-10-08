import { useCallback, useEffect, useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { fetchEvaluationHistory, isApiConfigured, type EvaluationHistory, type HistoryEntry } from '../lib/api'
import { formatNumber } from '../lib/format'

/**
 * Everything this system has scored, read back from the database.
 *
 * The lab says "stored as 6ac543c4". That is a claim, and claims are what this
 * project is otherwise careful about, so the record is shown rather than
 * asserted: the aggregate comes from a MongoDB aggregation over every stored
 * document, not from a counter this page increments.
 *
 * What is deliberately *not* claimed: a trend. Every evaluation so far is the
 * same sample series, so "accuracy over time" would be a flat line that says
 * nothing. This is a ledger, and it says so.
 *
 * The response carries measurements only. The uploaded series never leaves the
 * database, because this endpoint is public.
 */

const REFRESH_AFTER_EVALUATION_MS = 900

export function EvaluationHistory({ refreshToken = 0 }: { refreshToken?: number }) {
  const { t, locale } = useI18n()
  const [data, setData] = useState<EvaluationHistory | null>(null)
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!isApiConfigured) {
        setLoading(false)
        return
      }
      try {
        setData(await fetchEvaluationHistory(signal))
        setFailed(false)
      } catch (error) {
        if ((error as Error).name === 'AbortError') return
        setFailed(true)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load, refreshToken])

  // Re-read shortly after a new evaluation so the row the visitor just created is
  // in the list. `refreshToken` changes when one lands.
  useEffect(() => {
    if (refreshToken === 0) return
    const timer = setTimeout(() => void load(), REFRESH_AFTER_EVALUATION_MS)
    return () => clearTimeout(timer)
  }, [refreshToken, load])

  if (!isApiConfigured || loading) return null

  // A plain div, not a section: this renders inside the lab's own section, which
  // already owns the page container and its horizontal padding. Nesting a second
  // one would indent the card inside the first for no reason.
  return (
    <div className="mt-10">
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-body">
              <Database className="size-4 text-gold" strokeWidth={2} />
              {t('history.title')}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-body/80">{t('history.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true)
              void load()
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-body transition-colors hover:border-gold/40 hover:text-gold"
          >
            <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
            {t('history.refresh')}
          </button>
        </div>

        {failed && <p className="mt-4 text-sm text-aws">{t('history.failed')}</p>}

        {!failed && data && data.enabled && data.total > 0 && (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t('history.statTotal')}
                value={formatNumber(data.total, 0, locale)}
                hint={t('history.statTotalHint')}
              />
              <Stat
                label={t('history.statBeaten')}
                value={data.beatenBaselinePct === null ? '—' : `${formatNumber(data.beatenBaselinePct, 0, locale)}%`}
                hint={t('history.statBeatenHint')}
                emphasis
              />
              <Stat
                label={t('history.statAvg')}
                value={data.avgWape === null || data.avgWape === undefined ? '—' : `${formatNumber(data.avgWape, 2, locale)}%`}
                hint={
                  data.avgBaselineWape === null || data.avgBaselineWape === undefined
                    ? t('history.statAvgEmpty')
                    : t('history.statAvgHint', { baseline: formatNumber(data.avgBaselineWape, 2, locale) })
                }
              />
              <Stat
                label={t('history.statSpread')}
                value={`${data.worstImprovementPct === null || data.worstImprovementPct === undefined ? '—' : formatNumber(data.worstImprovementPct, 1, locale)}% → ${data.bestImprovementPct === null || data.bestImprovementPct === undefined ? '—' : formatNumber(data.bestImprovementPct, 1, locale)}%`}
                hint={t('history.statSpreadHint')}
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              {/* `min-w` keeps the columns from crushing their numbers on a phone,
                  but the `w-full` inside a scroll container must not be allowed to
                  widen the page. `max-w-full` on the wrapper is what stops the
                  sticky-header 404 we measured at 320px. */}
              <table className="w-full min-w-[34rem] max-w-full text-left text-xs">
                <thead className="text-body/60">
                  <tr>
                    <th className="py-2 pr-4 font-medium">{t('history.colWhen')}</th>
                    <th className="py-2 pr-4 font-medium">{t('history.colSource')}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t('history.colPoints')}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t('history.colWape')}</th>
                    <th className="py-2 pr-4 text-right font-medium">{t('history.colBaseline')}</th>
                    <th className="py-2 text-right font-medium">{t('history.colImprovement')}</th>
                  </tr>
                </thead>
                <tbody className="text-body">
                  {data.recent.map((entry) => (
                    <tr key={entry.id} className="border-t border-line/60">
                      <td className="py-2 pr-4 font-mono text-[11px] text-body/70">
                        {formatWhen(entry.at, locale)}
                      </td>
                      <td className="py-2 pr-4">{entry.source ?? '—'}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {entry.points === null ? '—' : formatNumber(entry.points, 0, locale)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {entry.wape === null ? '—' : `${formatNumber(entry.wape, 2, locale)}%`}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums text-body/70">
                        {entry.baselineWape === null ? '—' : `${formatNumber(entry.baselineWape, 2, locale)}%`}
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums ${
                          (entry.improvementPct ?? 0) >= 0 ? 'text-gold' : 'text-red-400'
                        }`}
                      >
                        {entry.improvementPct === null
                          ? '—'
                          : `${entry.improvementPct > 0 ? '+' : ''}${formatNumber(entry.improvementPct, 1, locale)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-body/60">
              {describeLedger(t, data)}
            </p>
          </>
        )}

        {!failed && data && (!data.enabled || data.total === 0) && (
          <p className="mt-4 text-sm text-body/80">{t('history.empty')}</p>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string
  value: string
  hint: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-xl border border-line bg-ink p-3">
      <p className="text-[11px] uppercase tracking-[0.1em] text-body/70">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${emphasis ? 'text-gold' : 'text-white'}`}>{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-body/60">{hint}</p>
    </div>
  )
}

/** Short local timestamp; the id is the full audit trail, this is only for reading. */
function formatWhen(iso: string | null, locale: 'es' | 'en'): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * Whether the ledger is one series repeated or genuinely several.
 *
 * The sample CSV is anchored to its build date, so a rebuild shifts the weekdays
 * and the same file measures differently: the stored records already contain both
 * 10.40 % and 8.88 % for it. A caption claiming "the same series every time" is
 * therefore only sometimes true, so it is decided from the data instead of
 * asserted in the copy.
 */
function isSingleSeries(recent: HistoryEntry[]): boolean {
  if (recent.length < 2) return true
  const first = `${recent[0].points}:${recent[0].wape}`
  return recent.every((entry) => `${entry.points}:${entry.wape}` === first)
}

/**
 * Two honest sentences: what the aggregate is, and what it is not.
 *
 * `t` is passed rather than read from context so the wording can differ per locale
 * without this helper needing to be a component.
 */
function describeLedger(
  t: (key: string, vars?: Record<string, string | number>) => string,
  data: EvaluationHistory,
): string {
  const repeat = t('history.noteSeries')
  const diverse = t('history.noteDiverse')
  const privacy = t('history.notePrivacy')

  return `${isSingleSeries(data.recent) ? repeat : diverse} ${privacy}`
}