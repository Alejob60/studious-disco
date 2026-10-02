/**
 * Lightweight legal metadata: slugs and labels only.
 *
 * Kept separate from `content/legal.ts` so the header, footer and cookie banner
 * can link to a policy without pulling every policy body into the main bundle.
 */

export type LegalDocId = 'privacy' | 'terms' | 'cookies' | 'refunds'

/** Slugs in the URL, kept stable across locales for easy linking. */
export const LEGAL_SLUG: Record<LegalDocId, string> = {
  privacy: 'privacidad',
  terms: 'terminos',
  cookies: 'cookies',
  refunds: 'reembolsos',
}

export const LEGAL_SLUG_EN: Record<LegalDocId, string> = {
  privacy: 'privacy',
  terms: 'terms',
  cookies: 'cookies',
  refunds: 'refunds',
}

export const LEGAL_LABELS: Record<'es' | 'en', Record<LegalDocId, string>> = {
  es: {
    privacy: 'Política de privacidad',
    terms: 'Términos y condiciones',
    cookies: 'Política de cookies',
    refunds: 'Política de reembolsos',
  },
  en: {
    privacy: 'Privacy policy',
    terms: 'Terms and conditions',
    cookies: 'Cookie policy',
    refunds: 'Refund policy',
  },
}

export const LEGAL_ORDER: LegalDocId[] = ['privacy', 'terms', 'cookies', 'refunds']

export function docIdFromSlug(slug: string | undefined, locale: 'es' | 'en'): LegalDocId | null {
  if (!slug) return null
  const map = locale === 'en' ? LEGAL_SLUG_EN : LEGAL_SLUG
  const found = LEGAL_ORDER.find((id) => map[id] === slug)
  return found ?? null
}

export function slugFromDocId(id: LegalDocId, locale: 'es' | 'en'): string {
  return (locale === 'en' ? LEGAL_SLUG_EN : LEGAL_SLUG)[id]
}