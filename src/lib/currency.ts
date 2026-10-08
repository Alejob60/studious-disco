/**
 * Currency presentation.
 *
 * Everything is **USD**. This started with a COP figure carrying a USD
 * equivalent — "$599 (COP 2,395,611)" — and a sentence that priced the margin in
 * COP and the result in dollars. A reader had to hold two currencies to check one
 * claim, and the arithmetic did not survive the round trip: COP 18,500 is USD
 * 4.625, which rendered as "$5", so redoing the sum from the printed margin came
 * out eight percent away from the printed total. The judges are US-based and the
 * customers being modelled are sold to from Colombia, so one currency, plainly
 * stated, is worth more than a conversion the reader has to trust.
 *
 * The contribution margin remains an **assumption**, not a market fact, and it
 * travels with every figure so the interface never hardcodes it. It is the one
 * number a customer must replace with their own.
 */

/** The margin the savings figure is priced at, in USD per unit. */
export const UNIT_MARGIN_USD = 4.6

/** Formats a USD amount for the reader's locale. */
export function formatUsd(
  usdValue: number,
  locale: 'es' | 'en',
  decimals = 0,
): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CO', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(usdValue)
}