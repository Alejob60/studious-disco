/**
 * Currency presentation.
 *
 * The model itself is currency-agnostic: it forecasts units, and the backend
 * prices the error reduction at a contribution margin expressed in COP. Only the
 * presentation is converted here.
 *
 * The rate is an explicit assumption, not a live quote: we do not call a rates API
 * on a public landing page, and a figure that silently changes between page loads
 * is worse than one that is stated. Both figures are shown wherever a money amount
 * appears, so the arithmetic is checkable:
 *
 *   2,395,611 COP / 4,000 = 599 USD
 *   18,500 COP margin / 4,000 = 4.63 USD per unit
 *
 * Judges and reviewers are US-based, so USD leads and COP follows.
 */
export const COP_PER_USD = 4000

/** Converts a COP amount to USD at the stated rate. */
export function toUsd(copValue: number): number {
  return copValue / COP_PER_USD
}

/**
 * Formats a COP amount as USD with the COP equivalent underneath, so the
 * conversion is never a black box.
 *
 * `decimals` defaults to 0, which is right for a headline savings figure of
 * hundreds of dollars. It must be raised for a small unit-level amount: the
 * margin is COP 18,500, or USD 4.625, and rounding that to "$5" makes the
 * arithmetic a judge is invited to check come out eight percent wrong.
 */
export function formatMoneyUsd(
  copValue: number,
  locale: 'es' | 'en',
  decimals = 0,
): string {
  const usd = toUsd(copValue)
  const usdText = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(usd)

  const copText = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(copValue)

  return `${usdText} (${copText})`
}

/** Formats a USD amount with no COP counterpart, for chat chips. */
export function formatUsd(usdValue: number, locale: 'es' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(usdValue)
}

/** The per-unit contribution margin, in both currencies. */
export const UNIT_MARGIN_COP = 18500

export function unitMarginUsd(): number {
  return UNIT_MARGIN_COP / COP_PER_USD
}