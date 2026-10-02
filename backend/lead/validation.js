/**
 * Pure validation for the lead payload.
 *
 * Kept separate from `index.js` so it can be unit tested without a Lambda
 * runtime, a network or a Secrets Manager round trip.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const MAX_NAME = 160
const MAX_SHORT = 320
const MAX_LONG = 4000

/** Allowed `interests` values. Anything else is dropped rather than rejected. */
const ALLOWED_INTERESTS = ['government', 'business', 'investment']

const REQUIRED_FIELDS = ['name', 'email', 'company', 'role', 'challenge']

/** Trims and length-caps an untrusted value. */
function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Escapes a value for interpolation into an HTML email body.
 *
 * Lead data is attacker-controlled: without this, a submitter could inject markup
 * into the notification email that lands in the sales inbox.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Normalises a raw request body into a validated lead.
 *
 * Returns `{ ok: false }` rather than throwing so the caller can map the failure
 * onto the HTTP contract.
 */
function parseLead(payload) {
  const name = clean(payload && payload.name, MAX_NAME)
  const email = clean(payload && payload.email, MAX_SHORT).toLowerCase()
  const company = clean(payload && payload.company, MAX_SHORT)
  const role = clean(payload && payload.role, MAX_SHORT)
  const challenge = clean(payload && payload.challenge, MAX_LONG)
  const locale = clean(payload && payload.locale, 8) === 'en' ? 'en' : 'es'

  const interests = Array.isArray(payload && payload.interests)
    ? payload.interests
        .filter((item) => typeof item === 'string')
        .filter((item) => ALLOWED_INTERESTS.includes(item))
        .slice(0, 5)
    : []

  // Honeypot: a filled hidden field means a bot. Reported separately so the
  // caller can answer 201 without sending mail.
  const isHoneypot = clean(payload && payload.website, 200).length > 0

  const errors = []
  if (!name) errors.push('name')
  if (!company) errors.push('company')
  if (!role) errors.push('role')
  if (!challenge) errors.push('challenge')
  if (!EMAIL_PATTERN.test(email) || email.length > 254) errors.push('email')

  return {
    ok: errors.length === 0,
    errors,
    isHoneypot,
    lead: { name, email, company, role, challenge, locale, interests },
  }
}

/** Builds the multi-line notes field sent to the optional CRM endpoint. */
function buildNotes(lead, labels, sourceTag) {
  return [
    lead.role ? `Cargo: ${lead.role}` : '',
    lead.interests.length ? `Intereses: ${lead.interests.map((key) => labels[key] || key).join(', ')}` : '',
    lead.challenge ? `Desafío: ${lead.challenge}` : '',
    `Origen: ${sourceTag}`,
    `Locale: ${lead.locale}`,
  ]
    .filter(Boolean)
    .join('\n')
}

module.exports = {
  ALLOWED_INTERESTS,
  REQUIRED_FIELDS,
  buildNotes,
  clean,
  escapeHtml,
  parseLead,
}