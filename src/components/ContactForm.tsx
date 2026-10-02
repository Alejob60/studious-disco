import { useState, type ChangeEvent, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { AlertTriangle, CheckCircle2, Loader2, Mail, RotateCcw, Send } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { trackEvent } from '../lib/analytics'

type InterestKey = 'government' | 'business' | 'investment'
type FieldName = 'name' | 'email' | 'company' | 'role' | 'challenge'
type Status = 'idle' | 'submitting' | 'success' | 'error'
type Failure = 'rate' | 'delivery' | null

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INTERESTS: InterestKey[] = ['government', 'business', 'investment']

const EMPTY = {
  name: '',
  email: '',
  company: '',
  role: '',
  challenge: '',
  interests: [] as InterestKey[],
  // Honeypot: hidden from humans, tempting for bots.
  website: '',
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

const LABEL = 'block text-sm font-medium text-white'
const INPUT_BASE =
  'w-full rounded-xl border border-line bg-ink px-4 py-3 text-sm text-white placeholder:text-white/25 transition-colors focus:outline-none'

const inputClass = (invalid: boolean) =>
  `${INPUT_BASE} ${invalid ? 'border-red-500/70 focus:border-red-500' : 'focus:border-gold/50'}`

/**
 * Contact form for the hackathon landing.
 *
 * Mirrors the validation, honeypot and error mapping of the ColombiaTIC form so
 * the sales team receives leads in the same shape from both sites. The only
 * difference is the endpoint: this one is our own Lambda, which tags the origin
 * as `atelier-predict-hackathon`.
 */
export function ContactForm() {
  const { t, locale } = useI18n()
  const reduceMotion = useReducedMotion()

  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [failure, setFailure] = useState<Failure>(null)

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    const field = name as FieldName

    setValues((previous) => ({ ...previous, [field]: value }))
    setErrors((previous) => {
      if (!previous[field]) return previous
      const next = { ...previous }
      delete next[field]
      return next
    })
  }

  const toggleInterest = (interest: InterestKey) => {
    setValues((previous) => ({
      ...previous,
      interests: previous.interests.includes(interest)
        ? previous.interests.filter((item) => item !== interest)
        : [...previous.interests, interest],
    }))
  }

  const validate = () => {
    const next: Partial<Record<FieldName, string>> = {}

    if (!values.name.trim()) next.name = 'contact.errors.name'
    if (!values.email.trim()) next.email = 'contact.errors.email'
    else if (!EMAIL_PATTERN.test(values.email.trim())) next.email = 'contact.errors.emailInvalid'
    if (!values.company.trim()) next.company = 'contact.errors.company'
    if (!values.role.trim()) next.role = 'contact.errors.role'
    if (!values.challenge.trim()) next.challenge = 'contact.errors.challenge'

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    if (!API_URL) {
      setFailure('delivery')
      setStatus('error')
      return
    }

    setStatus('submitting')
    setFailure(null)
    trackEvent({ name: 'lead_form_submit', locale, interests: values.interests })

    try {
      const response = await fetch(`${API_URL}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, locale }),
      })

if (!response.ok) {
        if (response.status === 429) setFailure('rate')
        else if (response.status >= 500) setFailure('delivery')
        trackEvent({ name: 'lead_form_error', reason: String(response.status) })
        setStatus('error')
        return
      }

      const result = (await response.json().catch(() => ({}))) as { emailed?: boolean }
      trackEvent({ name: 'lead_form_success', emailed: result.emailed === true })
      setStatus('success')
    } catch {
      trackEvent({ name: 'lead_form_error', reason: 'network' })
      setStatus('error')
      setFailure('delivery')
    }
  }

  const reset = () => {
    setValues(EMPTY)
    setErrors({})
    setStatus('idle')
    setFailure(null)
  }

  const errorKey =
    failure === 'rate'
      ? 'contact.errors.rate'
      : failure === 'delivery'
        ? 'contact.errors.delivery'
        : 'contact.errors.generic'

  const errorTail =
    failure === 'delivery' ? (
      <>
        {' '}
        <a href="mailto:enterprise@colombiatic.com.co" className="text-gold underline underline-offset-2">
          enterprise@colombiatic.com.co
        </a>
      </>
    ) : null

  return (
    <section id="contacto" className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 text-center"
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/5 px-3.5 py-1.5 text-xs font-medium text-gold">
          <Mail className="size-3.5" strokeWidth={2} />
          {t('contact.badge')}
        </span>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('contact.title')}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-body sm:text-base">
          {t('contact.subtitle')}
        </p>
      </motion.div>

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-8"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
        />

        {status === 'success' ? (
          <div className="py-8 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full border border-gold/30 bg-gold/10">
              <CheckCircle2 className="size-8 text-gold" strokeWidth={1.75} />
            </span>
            <h3 className="mt-6 text-xl font-bold text-white sm:text-2xl">
              {t('contact.successTitle')}
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-body">
              {t('contact.successBody')}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-7 inline-flex items-center gap-2 rounded-xl border border-line-strong px-5 py-2.5 text-sm font-medium text-white transition-colors hover:border-gold/40 hover:bg-gold/5"
            >
              <RotateCcw className="size-4" strokeWidth={2} />
              {t('contact.sendAnother')}
            </button>
          </div>
        ) : (
          <>
            {status === 'error' && (
              <div role="alert" className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-300">
                  <AlertTriangle className="size-4 shrink-0" strokeWidth={2} />
                  {t('contact.errorTitle')}
                </p>
                <p className="mt-1 text-sm text-red-300/85">
                  {t(errorKey)}
                  {errorTail}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {/* Honeypot. Hidden from assistive tech and keyboard users. */}
              <div aria-hidden className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="lead-website">Website</label>
                <input
                  id="lead-website"
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={values.website}
                  onChange={handleChange}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id="lead-name"
                  name="name"
                  label={t('contact.nameLabel')}
                  autoComplete="name"
                  value={values.name}
                  error={errors.name}
                  onChange={handleChange}
                />
                <Field
                  id="lead-email"
                  name="email"
                  type="email"
                  label={t('contact.emailLabel')}
                  autoComplete="email"
                  value={values.email}
                  error={errors.email}
                  onChange={handleChange}
                />
                <Field
                  id="lead-company"
                  name="company"
                  label={t('contact.companyLabel')}
                  autoComplete="organization"
                  value={values.company}
                  error={errors.company}
                  onChange={handleChange}
                />
                <Field
                  id="lead-role"
                  name="role"
                  label={t('contact.roleLabel')}
                  autoComplete="organization-title"
                  value={values.role}
                  error={errors.role}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label htmlFor="lead-challenge" className={LABEL}>
                  {t('contact.challengeLabel')}
                </label>
                <textarea
                  id="lead-challenge"
                  name="challenge"
                  rows={4}
                  value={values.challenge}
                  onChange={handleChange}
                  aria-invalid={Boolean(errors.challenge)}
                  aria-describedby={errors.challenge ? 'lead-challenge-error' : 'lead-challenge-hint'}
                  className={`mt-2 ${inputClass(Boolean(errors.challenge))}`}
                />
                {errors.challenge ? (
                  <p id="lead-challenge-error" role="alert" className="mt-2 text-sm text-red-400">
                    {t(errors.challenge)}
                  </p>
                ) : (
                  <p id="lead-challenge-hint" className="mt-2 text-xs text-white/35">
                    {t('contact.challengeHint')}
                  </p>
                )}
              </div>

              <fieldset>
                <legend className={LABEL}>{t('contact.interestLabel')}</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {INTERESTS.map((interest) => {
                    const selected = values.interests.includes(interest)
                    return (
                      <label
                        key={interest}
                        htmlFor={`lead-interest-${interest}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                          selected
                            ? 'border-gold/50 bg-gold/10'
                            : 'border-line bg-ink hover:border-line-strong'
                        }`}
                      >
                        <input
                          id={`lead-interest-${interest}`}
                          name="interests"
                          type="checkbox"
                          value={interest}
                          checked={selected}
                          onChange={() => toggleInterest(interest)}
                          className="mt-0.5 size-4 shrink-0 rounded border-line-strong bg-transparent accent-[#D4AF37]"
                        />
                        <span className="text-sm text-white">
                          {t(`contact.interests.${interest}`)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-gold to-gold-light px-6 py-3.5 text-sm font-semibold text-black transition-shadow hover:shadow-lg hover:shadow-gold/25 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {status === 'submitting' ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
                ) : (
                  <Send className="size-4" strokeWidth={2.5} />
                )}
                {status === 'submitting' ? t('contact.submitting') : t('contact.submit')}
              </button>

              <p className="text-sm text-body">
                {t('contact.directEmail')}{' '}
                <a
                  href="mailto:enterprise@colombiatic.com.co"
                  className="text-gold underline underline-offset-2 hover:text-gold-light"
                >
                  enterprise@colombiatic.com.co
                </a>
              </p>
            </form>
          </>
        )}

        <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-white/35">
          {t('contact.footnote')}
        </p>
      </motion.div>
    </section>
  )
}

function Field({
  id,
  name,
  label,
  value,
  error,
  onChange,
  type = 'text',
  autoComplete,
}: {
  id: string
  name: FieldName
  label: string
  value: string
  error?: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  type?: string
  autoComplete?: string
}) {
  const { t } = useI18n()

  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={onChange}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-2 ${inputClass(Boolean(error))}`}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-400">
          {t(error)}
        </p>
      )}
    </div>
  )
}
