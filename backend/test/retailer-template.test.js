const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { join, resolve } = require('node:path')

const { fromCsv } = require('../shared/evaluate-input.js')

/**
 * The template is what a customer actually opens, so it has to behave.
 *
 * Two failure modes matter and both are quiet. A template that is already valid
 * makes the customer think they are done before they have entered anything. And
 * a template that is never exercised here means the first person to really use it
 * is the one who finds out it does not work.
 */

const repoRoot = resolve(__dirname, '..', '..')

/** Builds the template, the same way `npm run build` does. */
function buildTemplate() {
  execFileSync(
    process.execPath,
    [join(repoRoot, 'scripts', 'generate-data-contract.mjs')],
    { cwd: repoRoot, encoding: 'utf8', timeout: 60_000 }
  )
  return readFileSync(join(repoRoot, 'dist', 'plantilla-demanda.csv'), 'utf8')
}

test('the template is generated with the documented minimum', () => {
  const text = buildTemplate()

  assert.match(text, /^date,units$/m, 'the two columns must be the header the parser looks for')
  assert.match(text, /28 días/, 'the minimum has to be written on the file itself')
  assert.match(text, /AAAA-MM-DD/, 'the safe date format has to be recommended, not just described')
  // Spanish Excel is the most likely cause of a rejected file, so it is on the
  // template rather than only in the long document nobody opens.
  assert.match(text, /punto y coma/)
  // The zero-day caveat, because a stock-out entered as a zero is the failure
  // this whole diagnostics layer exists to surface.
  assert.match(text, /agotado/)
})

test('an untouched template is refused with a reason, not accepted as a series', () => {
  const result = fromCsv(buildTemplate())

  // The comments are stripped, so what remains is a header and no rows. If this
  // ever starts passing, a customer could upload the blank template, get a WAPE
  // on nothing, and believe the product had measured their shop.
  assert.equal(result.ok, false)
  assert.ok(
    ['empty_series', 'empty_file', 'too_short'].includes(result.error),
    `unexpected error ${result.error}`,
  )
})

test('the template filled in the way the comments describe is accepted', () => {
  const rows = ['# El comentario de la plantilla sobrevive', 'date,units']
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(2026, 0, 1 + i)
    rows.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')},${100 + (i % 7) * 5}`,
    )
  }

  const result = fromCsv(rows.join('\n'))

  assert.equal(result.ok, true)
  assert.equal(result.series.length, 90)
  // The comment did not become a data point.
  assert.equal(result.series[0], 100)
  assert.equal(result.dates.length, 90)
})

test('the template works when the customer follows the semicolon advice', () => {
  // Colombian Excel, comma decimal, which the comments on the file point at.
  const rows = ['fecha;unidades']
  for (let i = 0; i < 90; i += 1) {
    const d = new Date(2026, 0, 1 + i)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    rows.push(`${day}/${month}/2026;${(100 + (i % 7) * 5).toLocaleString('es-CO')}`)
  }

  const result = fromCsv(rows.join('\n'))

  assert.equal(result.ok, true)
  assert.equal(result.series.length, 90)
  assert.equal(result.dates[0], '2026-01-01')
})

test('the generated contract names the minimum, the formats and the refusals', () => {
  execFileSync(process.execPath, [join(repoRoot, 'scripts', 'generate-data-contract.mjs')], {
    cwd: repoRoot, encoding: 'utf8', timeout: 60_000,
  })
  const doc = readFileSync(join(repoRoot, 'docs', 'CONTRATO-DATOS.md'), 'utf8')

  assert.match(doc, /## Lo mínimo indispensable/)
  assert.match(doc, /\*\*28 días\*\*/, 'the enforced minimum must be stated plainly')
  assert.match(doc, /90 días/)
  assert.match(doc, /punto y coma/)
  // The day-first rule has to be a warning, not a footnote.
  assert.match(doc, /⚠️/)
  assert.match(doc, /día-primero/i)
  // And the columns we refuse need their reasons.
  assert.match(doc, /stock_disponible/)
  assert.match(doc, /too_short/)
})