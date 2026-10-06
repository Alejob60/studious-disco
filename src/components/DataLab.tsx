import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, Loader2, Upload } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { trackEvent } from '../lib/analytics'
import { EvaluationError, evaluateSeries, isApiConfigured, type EvaluationResponse } from '../lib/api'
import { formatMoneyUsd } from '../lib/currency'
import { formatNumber } from '../lib/format'

/**
 * "Try it on your own data."
 *
 * The dashboard above runs on a synthetic series, which is honest but leaves a
 * judge with nothing to push back on. This section closes that gap by running
 * the same model over a series the visitor supplies, and showing the comparison
 * against the naive baseline that a spreadsheet could have produced.
 *
 * Two things are deliberately exposed rather than smoothed over:
 *
 *   - The exact CSV text, editable, so the effect of a change is immediate. A
 *     file picker alone would make the model look like a black box.
 *   - Whether the evaluation was recorded. The number is the product; the
 *     persistence is the difference between a demo and a system that can show a
 *     customer their own accuracy over time, and claiming the second without
 *     showing it would be the exact thing this project is otherwise careful
 *     about.
 */

const SAMPLE_URL = '/sample-demand.csv'

/** Only the first rows are shown; the whole file stays in the textarea. */
const PREVIEW_ROWS = 6

type Status = 'idle' | 'loading' | 'done' | 'error'

export function DataLab() {
  const { t, locale } = useI18n()
  const [csv, setCsv] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<EvaluationResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  async function loadSample() {
    trackEvent({ name: 'sample_csv_downloaded', locale })
    // A plain anchor would be simpler, but the file is generated at build time in
    // the SPA's own public directory, so fetch keeps the origin check in one place.
    const response = await fetch(SAMPLE_URL)
    const text = await response.text()
    setCsv(text)
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    trackEvent({ name: 'csv_uploaded', locale, size: file.size })
    setCsv(text)
    setStatus('idle')
    setResult(null)
    setError(null)
  }

  async function submit(source: string) {
    if (!csv.trim()) return
    setStatus('loading')
    setError(null)

    try {
      const evaluation = await evaluateSeries(csv, source, locale)
      setResult(evaluation)
      setStatus('done')
      trackEvent({
        name: 'evaluation_completed',
        locale,
        points: evaluation.points,
        persisted: evaluation.persistence.persisted,
      })
    } catch (caught) {
      setStatus('error')
      // The parser's row-level reason is the whole point of the API returning
      // one, so it is shown verbatim instead of being flattened to a message.
      setError(
        caught instanceof EvaluationError
          ? `${t('lab.errorPrefix')} ${caught.message}`
          : t('lab.errorNetwork'),
      )
    }
  }

  const canSubmit = isApiConfigured && status !== 'loading' && csv.trim().length > 0
  const preview = csv.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '').slice(0, PREVIEW_ROWS)

  return (
    <section id="lab" className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          {t('lab.eyebrow')}
        </p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('lab.title')}
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-body">{t('lab.lead')}</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-body">
            {t('lab.stepData')}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-body">{t('lab.stepDataBody')}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadSample}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-body transition-colors hover:border-gold/40 hover:text-gold"
            >
              <Download className="size-4" strokeWidth={2} />
              {t('lab.loadSample')}
            </button>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-body transition-colors hover:border-gold/40 hover:text-gold"
            >
              <Upload className="size-4" strokeWidth={2} />
              {t('lab.upload')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => {
                void onFile(event.target.files?.[0])
                // Reset so re-picking the same file fires a change event again.
                event.target.value = ''
              }}
            />
          </div>

          <label htmlFor="lab-csv" className="mt-5 block text-xs font-semibold uppercase tracking-[0.12em] text-body">
            {t('lab.csvLabel')}
          </label>
          <textarea
            id="lab-csv"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            spellCheck={false}
            rows={PREVIEW_ROWS + 1}
            placeholder={t('lab.csvPlaceholder')}
            className="mt-2 w-full rounded-xl border border-line bg-ink px-3 py-2 font-mono text-xs leading-relaxed text-body transition-colors focus:border-gold/50 focus:text-white"
          />
          <p className="mt-2 text-xs text-body/70">{t('lab.csvHint')}</p>

          <button
            type="button"
            onClick={() => void submit(csv === '' ? 'empty' : 'edit')}
            disabled={!canSubmit}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold to-gold-light px-4 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {status === 'loading' ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <CheckCircle2 className="size-4" strokeWidth={2} />
            )}
            {status === 'loading' ? t('lab.running') : t('lab.run')}
          </button>

          {preview.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left font-mono text-xs text-body/70">
                <tbody>
                  {preview.map((line, index) => (
                    <tr key={index}>
                      <td className="py-0.5 pr-4">{index + 1}</td>
                      <td className="truncate">{line}</td>
                    </tr>
                  ))}
                  {csv.split(/\r\n|\n|\r/).filter((line) => line.trim() !== '').length > PREVIEW_ROWS && (
                    <tr>
                      <td />
                      <td className="pt-2 italic">…</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-body">
            {t('lab.stepResult')}
          </h3>

          {status === 'error' && (
            <div className="mt-4 flex gap-3 rounded-xl border border-aws/30 bg-aws-bg p-4 text-sm text-aws">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
              <p className="leading-relaxed">{error}</p>
            </div>
          )}

          {status !== 'done' && !error && (
            <p className="mt-4 text-sm leading-relaxed text-body/70">{t('lab.idle')}</p>
          )}

          {result && <Result result={result} />}
        </div>
      </div>
    </section>
  )
}

function Result({ result }: { result: EvaluationResponse }) {
  const { t, locale } = useI18n()
  const { metrics, kpis, persistence } = result

  const better = metrics.wape < metrics.baselineWape

  return (
    <div className="mt-4 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Metric
          label={t('lab.metricWape')}
          value={`${metrics.wape}%`}
          hint={t('lab.metricWapeHint')}
          emphasis
        />
        <Metric
          label={t('lab.metricBaseline')}
          value={`${metrics.baselineWape}%`}
          hint={t('lab.metricBaselineHint')}
        />
        <Metric
          label={t('lab.metricImprovement')}
          value={`${better ? '+' : ''}${metrics.improvementPct}%`}
          hint={t('lab.metricImprovementHint')}
          emphasis={better}
        />
        <Metric
          label={t('lab.metricMae')}
          value={formatNumber(metrics.modelMaeUnits, 1)}
          hint={t('lab.metricMaeHint', { baseline: formatNumber(metrics.baselineMaeUnits, 1) })}
        />
      </div>

      <div className="rounded-xl border border-line bg-ink p-4 text-sm text-body">
        <p className="leading-relaxed">
          {t('lab.resultSentence', {
            points: formatNumber(result.points),
            holdout: formatNumber(metrics.holdoutPoints),
            peak: kpis.peakDay,
            units: formatNumber(kpis.peakUnits),
          })}
        </p>
        {kpis.inventorySavingsCop > 0 && (
          <p className="mt-2 leading-relaxed">
            {t('lab.savingsSentence', { money: formatMoneyUsd(kpis.inventorySavingsCop, locale) })}
          </p>
        )}
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-body/70">
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-gold" strokeWidth={2} />
        {persistence.persisted
          ? t('lab.persisted', {
              id: persistence.evaluationId?.slice(0, 8) ?? '',
              days: formatNumber(persistence.retentionDays ?? 0),
            })
          : t('lab.notPersisted')}
      </p>
    </div>
  )
}

function Metric({
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
      <p className={`mt-1 text-lg font-bold ${emphasis ? 'text-gold' : 'text-white'}`}>{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-body/60">{hint}</p>
    </div>
  )
}