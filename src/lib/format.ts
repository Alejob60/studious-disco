/** Formats a number with the es-CO convention (dot as thousands separator). */
export function formatNumber(value: number, decimals = 0) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** Formats a signed percentage change, always showing the sign. */
export function formatDelta(delta: number, decimals = 1) {
  const sign = delta > 0 ? '+' : ''
  return `${sign}${formatNumber(delta, decimals)}%`
}