/**
 * Lead capture for the Atelier Predict hackathon landing.
 *
 * Mirrors the validated pipeline from colombiatic.com.co (honeypot, rate limit,
 * HTML escaping, field caps, dual Resend delivery) with two differences:
 *
 *  1. Every notification is tagged so hackathon leads can be told apart from the
 *     main landing: `SOURCE_TAG` shows up in the subject, the email body and the
 *     optional CRM payload.
 *  2. The Resend key arrives through a CloudFormation dynamic reference to AWS
 *     Secrets Manager, never as a literal in the template.
 */

const SECRET_ID = process.env.LEAD_RESEND_SECRET_ID ?? ''
const TEAM_EMAIL = (process.env.LEAD_NOTIFICATION_EMAIL ?? 'enterprise@colombiatic.com.co').trim()
const FROM_EMAIL = (process.env.LEAD_FROM_EMAIL ?? 'ColombiaTIC <onboarding@colombiatic.com.co>').trim()
const SOURCE_TAG = process.env.LEAD_SOURCE_TAG ?? 'atelier-predict-hackathon'

// Optional secondary persistence, same shape the ColombiaTIC landing uses.
const CRM_BASE = (process.env.CRM_API_BASE ?? '').replace(/\/+$/, '')

const { buildNotes, escapeHtml, parseLead } = require('./validation.js')



const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX_KEYS = 5000

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  // CORS itself lives on the HTTP API (infra/template.yaml).
  'Cache-Control': 'no-store',
}

const INTERESTS = {
  es: {
    government: 'Gobierno y sector público',
    business: 'Empresas y comercio',
    investment: 'Inversión',
  },
  en: {
    government: 'Government and public sector',
    business: 'Business and commerce',
    investment: 'Investment',
  },
}

const SUBJECTS = {
  es: {
    team: `Nuevo lead desde Atelier Predict (hackathon)`,
    visitor: 'Recibimos tu solicitud — Atelier Predict',
    visitorBody:
      'Hola {{name}}, gracias por escribirnos. Tu solicitud ya está con nuestro equipo y te responderemos en menos de 24 horas hábiles.',
  },
  en: {
    team: 'New lead from Atelier Predict (hackathon)',
    visitor: 'We received your request — Atelier Predict',
    visitorBody:
      'Hi {{name}}, thank you for reaching out. Your request is now with our team and we will reply within one business day.',
  },
}

// ── rate limiting ────────────────────────────────────────────────────────────
const rateLimitHits = new Map()

function isRateLimited(key) {
  const now = Date.now()
  const recent = (rateLimitHits.get(key) ?? []).filter((at) => now - at < RATE_LIMIT_WINDOW_MS)

  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitHits.set(key, recent)
    return true
  }

  recent.push(now)

  if (rateLimitHits.size > RATE_LIMIT_MAX_KEYS) {
    for (const [stored, times] of rateLimitHits) {
      if (!times.some((at) => now - at < RATE_LIMIT_WINDOW_MS)) rateLimitHits.delete(stored)
    }
  }

  rateLimitHits.set(key, recent)
  return false
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
}

function row(label, value) {
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px">${escapeHtml(value)}</td></tr>`
}

async function sendWithResend(apiKey, payload) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error(`[lead] resend status=${response.status} detail=${detail.slice(0, 300)}`)
      return false
    }

    return true
  } catch (error) {
    console.error('[lead] resend request failed', error)
    return false
  }
}

/**
 * Reads the Resend key from Secrets Manager.
 *
 * A dynamic reference would inline the value into the environment, which would
 * then be readable by anyone with lambda:GetFunctionConfiguration. Fetching it
 * at runtime keeps it out of the function configuration, so this function only
 * needs secretsmanager:GetSecretValue on one secret.
 */
async function resolveResendKey() {
  if (!SECRET_ID) return ''
  if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY

  const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager')
  const client = new SecretsManagerClient({ maxAttempts: 3, retryMode: 'standard' })
  const result = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }))
  return result.SecretString ?? ''
}

async function main(event) {
  let payload
  try {
    payload = JSON.parse(event.body ?? '{}')
  } catch {
    return respond(400, { success: false, error: 'invalid_payload' })
  }

const { ok, isHoneypot, lead } = parseLead(payload)

  // Honeypot: bots fill hidden fields. Answer 201 so they learn nothing.
  if (isHoneypot) {
    return respond(201, { success: true, persisted: false, emailed: false })
  }

  if (!ok) {
    return respond(400, { success: false, error: 'invalid_fields' })
  }

const { name, email, company, role, challenge, locale, interests } = lead

  const clientKey =
    event.requestContext?.http?.sourceIp ??
    event.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ??
    'unknown'

  if (isRateLimited(clientKey)) {
    return respond(429, { success: false, error: 'rate_limited' })
  }

  const labels = INTERESTS[locale]
  const interestLabel = interests.map((key) => labels[key] ?? key).join(', ')

  // Optional CRM persistence; failure must not lose the lead.
  let persisted = false
  if (CRM_BASE) {
    try {
const notes = buildNotes(lead, labels, SOURCE_TAG)

      const response = await fetch(`${CRM_BASE}/demo-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, company, source: SOURCE_TAG, notes }),
        signal: AbortSignal.timeout(8000),
      })
      persisted = response.ok
    } catch (error) {
      console.error('[lead] crm unreachable', error)
    }
  }

  const resendKey = await resolveResendKey()
  const copy = SUBJECTS[locale]

  let emailed = false
  if (resendKey) {
    const detailRows = [
      row('Nombre', name),
      row('Correo', email),
      row('Empresa', company),
      role ? row('Cargo', role) : '',
      interests.length ? row('Intereses', interestLabel) : '',
      row('Desafío', challenge.replace(/\n/g, '\n')),
      row('Origen', `${SOURCE_TAG} · locale ${locale}`),
    ].join('')

    const teamHtml = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:640px"><h2 style="margin:0 0 16px;font-size:18px;color:#111827">${escapeHtml(copy.team)}</h2><table style="width:100%;border-collapse:collapse">${detailRows}</table><p style="margin-top:20px;font-size:12px;color:#9ca3af">CRM: ${persisted ? 'persistido' : 'persistencia fallida o no configurada'}</p></div>`

    const teamText = [
      copy.team,
      '',
      `Nombre: ${name}`,
      `Correo: ${email}`,
      `Empresa: ${company}`,
      `Cargo: ${role || '-'}`,
      `Intereses: ${interestLabel || '-'}`,
      `Desafío: ${challenge}`,
      `Origen: ${SOURCE_TAG}`,
      `Locale: ${locale}`,
      '',
      `CRM: ${persisted ? 'persistido' : 'no persistido'}`,
    ].join('\n')

    const visitorHtml = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px"><h2 style="margin:0 0 12px;font-size:18px;color:#111827">${escapeHtml(copy.visitor)}</h2><p style="font-size:15px;color:#374151;line-height:1.6">${escapeHtml(copy.visitorBody.replace('{{name}}', name.split(' ')[0]))}</p></div>`

    const [teamSent, visitorSent] = await Promise.all([
      sendWithResend(resendKey, {
        to: [TEAM_EMAIL],
        from: FROM_EMAIL,
        subject: `${copy.team} — ${company}`,
        html: teamHtml,
        text: teamText,
      }),
      sendWithResend(resendKey, {
        to: [email],
        from: FROM_EMAIL,
        subject: copy.visitor,
        html: visitorHtml,
        text: copy.visitorBody.replace('{{name}}', name),
      }),
    ])

    emailed = teamSent || visitorSent
  } else {
    console.warn('[lead] no Resend key resolved: lead accepted but not emailed')
  }

  if (!persisted && !emailed) {
    return respond(502, { success: false, error: 'delivery_failed' })
  }

  return respond(201, { success: true, persisted, emailed, source: SOURCE_TAG })
}

async function handler(event) {
  try {
    return await main(event)
  } catch (error) {
    console.error('lead_failed', { name: error.name, message: error.message })
    return respond(500, { success: false, error: 'lead_failed' })
  }
}

module.exports = { handler }

