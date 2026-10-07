/**
 * Generates the sample CSV the visitor downloads.
 *
 * The demo runs on a synthetic series, which is the right default and a poor
 * thing to hand someone who wants to try the product with their own data. This
 * file is the bridge: a real export shape, with the quirks a real export has, so
 * a visitor can edit it, upload it, and watch the model score their own numbers
 * instead of ours.
 *
 * Two files are generated, and the difference between them is the point:
 *
 *   sample-demand.csv        what a clean POS export looks like
 *   sample-demand-real.csv   the same shop after reality happened to it
 *
 * The second one is not a joke. A fortnight with an empty shelf, a week the store
 * was shut, and two promotions are all ordinary, and feeding them to the model
 * silently produces a worse forecast that still reports a respectable WAPE. That
 * is the failure a retail customer would actually hit, so the demo shows the
 * diagnostics catching it rather than describing it.
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

// Deterministic noise, so the two files are the same series apart from the events
// below. That isolation is what makes a difference in WAPE attributable.
let seed = 20260401
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

/**
 * The base series: weekly rhythm, drift, payday and holidays, no disruptions.
 * Shared by both files, re-seeded so they are identical before the events land.
 */
function buildBase() {
  seed = 20260401
  const rows = []

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

    rows.push({ date, value: Math.max(1, Math.round(96 * drift * WEEKDAY[date.getDay()] * payday * holiday * noise)) })
  }

  return rows
}

/**
 * The same shop, a month later.
 *
 * Each disruption is something a real retailer recognises, and each is a trap for
 * a forecaster that trusts the file:
 *
 *   - A stock-out reads as zero demand, and the model learns those weekdays are
 *     quiet. This is the most common way a demand forecast silently goes wrong.
 *   - A closure week is seven consecutive zeros that are not even a demand signal.
 *   - A promotion is a spike with nothing in the calendar to anticipate it from.
 *
 * The events sit well before the last fortnight so the held-out window stays
 * clean: the point is what the model *learns* from the past, not a rigged test.
 */
function disrupt(rows) {
  const applied = []

  // Two stock-out episodes, 4 and 3 days, on ordinary weekdays.
  for (const [start, length] of [[40, 4], [95, 3]]) {
    for (let i = 0; i < length; i += 1) {
      const row = rows[start + i]
      if (row && row.value > 0) {
        row.value = 0
        applied.push({ kind: 'stock_out', date: row.date })
      }
    }
  }

  // A week of closures.
  for (let i = 0; i < 7; i += 1) {
    const row = rows[130 + i]
    if (row) {
      row.value = 0
      applied.push({ kind: 'closure', date: row.date })
    }
  }

  // Two promotions: one a spike, one a deeper but longer discount run.
  for (const [index, factor, length = 1] of [[70, 2.1], [150, 1.75, 3]]) {
    for (let i = 0; i < length; i += 1) {
      const row = rows[index + i]
      if (row) {
        row.value = Math.round(row.value * factor)
        applied.push({ kind: 'promotion', date: row.date })
      }
    }
  }

  return applied
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

// Comma delimiter and dot decimals, because that is what a POS export or a
// developer produces. The parser also handles the Spanish-locale variant (`;` and
// a comma decimal); using the plain one keeps the sample readable.
const render = (rows, header) =>
  [...header, 'date,units', ...rows.map((row) => `${format(row.date)},${row.value}`), ''].join('\n')

mkdirSync(outDir, { recursive: true })

const clean = buildBase()
const rough = buildBase()
const applied = disrupt(rough)

writeFileSync(
  join(outDir, 'sample-demand.csv'),
  render(clean, [
    '# Atelier Predict — serie de demanda de ejemplo',
    '# Tienda de barrio, 28 semanas, unidades vendidas por dia',
    '# Edita estos numeros o subelo tal cual: el modelo lo evalua de verdad.',
  ]),
  'utf8',
)

writeFileSync(
  join(outDir, 'sample-demand-real.csv'),
  render(rough, [
    '# Atelier Predict — la misma tienda, un mes despues',
    '# Incluye lo que de verdad pasa: dos quiebres de stock, una semana de cierre',
    '# y dos promociones. Sube este archivo y el sistema te dira que encontro.',
    `# ${applied.length} eventos insertados; los ultimos 14 dias estan limpios a proposito`,
  ]),
  'utf8',
)

const range = (rows) => `${Math.min(...rows.map((r) => r.value))} a ${Math.max(...rows.map((r) => r.value))}`
const zeroDays = rough.filter((r) => r.value === 0).length

console.log(
  `generated sample-demand.csv (${clean.length} days, ${range(clean)} units/day) ` +
    `and sample-demand-real.csv (${rough.length} days, ${range(rough)} units/day, ` +
    `${zeroDays} zero days across ${applied.length} disruptions)`,
)