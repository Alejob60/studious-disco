/**
 * Legal page titles, kept out of `legal.ts` so the SEO head can name a document
 * from a URL slug without importing every policy body into the main bundle.
 */

import type { LegalDocId } from './legal-meta'

export const LEGAL_TITLES: Record<LegalDocId, Record<'es' | 'en', string>> = {
  privacy: { es: 'Política de privacidad', en: 'Privacy Policy' },
  terms: { es: 'Términos y condiciones', en: 'Terms and Conditions' },
  cookies: { es: 'Política de cookies', en: 'Cookie Policy' },
  refunds: { es: 'Política de reembolsos', en: 'Refund Policy' },
}

export const LEGAL_ORDER: LegalDocId[] = ['privacy', 'terms', 'cookies', 'refunds']