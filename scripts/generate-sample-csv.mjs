/**
 * Generates the sample CSV the visitor downloads.
 *
 * The demo runs on a synthetic series, which is the right default and a poor
 * thing to hand someone who wants to try the product with their own data. This
 * file is the bridge: a real export shape, with the quirks a real export has, so
 * a visitor can edit it, upload it, and watch the model score their own numbers
 * instead of ours.
 *
 * It is deliberately not a straight line. Retail demand has a weekly rhythm
 * (Saturday is the peak, Wednesday the trough), a mild upward drift, a payday
 * bump twice a month and a holiday spike. A series with none of that produces a
 * forecast that looks fine and proves nothing, because Holt-Winters only has to
 * beat the baseline on structure the baseline can already copy.
 *
 * Run from `postbuild`, so the download and the demo can never disagree.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = process.argv[2] ?? join(process.cwd(), 'dist')

const DAYS = 196 // 28 weeks: long enough to hold out a fortnight and still fit a season.
const START = new Date()
START.setDate(START.getDate() - DAYS)

// Weekly shape as a multiplier. Saturday carries the basket, Sunday collapses.
const WEEKDAY = [0.74, 0.79, 0.86, 0.9, 1.02, 1.31, 1.58]

function buildSeries() {
  const rows = []
  // The noise sequence is seeded, so the *values* are reproducible. The series is
  // still anchored to the build date, because a sample export whose last row is
  // four months old looks stale. That means the weekly multipliers land on
  // different weekdays after a rebuild, and the measured WAPE moves with them:
  // between two builds we have seen 10.40 % and 8.88 % on this same file. The
  // reader is told the ledger is not a trend for exactly this reason.
  let seed = 20260401
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }

  for (let index = 0; index < DAYS; index += 1) {
    const date = new Date(START)
    date.setDate(date.getDate() + index)

    const drift = 1 + index * 0.0011
    const payday = date.getDate() === 15 || date.getDate() === 30 ? 1.16 : 1
    const holiday = isHoliday(date) ? 1.55 : 1
    // Real daily demand is noisy: weather, a competitor opening, a stock-out, a
    // promo that was not in the plan. A tight noise band here would produce an
    // implausibly low error and read as a tuned demo rather than a real shop.
    const noise = 1 + (random() - 0.5) * 0.34

    const value = Math.max(1, Math.round(96 * drift * WEEKDAY[date.getDay()] * payday * holiday * noise))
    rows.push({ date, value })
  }

  return rows
}

/** Colombian retail peaks: Mother's Day in May, Father's Day in March, Christmas. */
function isHoliday(date) {
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (month === 12 && day >= 18 && day <= 24) return true
  if (month === 5 && day >= 6 && day <= 12) return true
  if (month === 3 && day >= 14 && day <= 20) return true
  return false
}

const format = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const rows = buildSeries()

// Comma delimiter and dot decimals, because that is what a developer or a POS
// export produces. The parser also handles the Spanish-locale variant (`;` and a
// comma decimal); using the plain one here keeps the sample readable.
const csv = [
  '# Atelier Predict — serie de demanda de ejemplo',
  '# Tienda de barrio, 28 semanas, unidades vendidas por dia',
  '# Edita estos numeros o subelo tal cual: el modelo lo evalua de verdad.',
  'date,units',
  ...rows.map((row) => `${format(row.date)},${row.value}`),
  '',
].join('\n')

mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'sample-demand.csv'), csv, 'utf8')

const first = rows[0].value
const last = rows[rows.length - 1].value
console.log(`generated sample-demand.csv (${rows.length} days, ${first} -> ${last} units/day)`)