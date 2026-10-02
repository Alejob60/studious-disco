/**
 * End-to-end integration check between the deployed frontend and the API.
 *
 * Covers the parts a browser would exercise that a unit test cannot: that the
 * shipped bundle points at the live API, that CORS preflight passes for the real
 * Amplify origin, and that all three endpoints satisfy the contract the UI reads.
 *
 * Usage: node scripts/verify-integration.mjs [siteUrl] [apiUrl]
 */

const site = (process.argv[2] ?? '').replace(/\/$/, '')
const api = (process.argv[3] ?? process.env.API_URL ?? '').replace(/\/$/, '')

if (!site || !api) {
  console.error('Usage: node scripts/verify-integration.mjs <siteUrl> <apiUrl>')
  process.exit(1)
}

const failures = []

function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${!ok && detail ? ` -> ${detail}` : ''}`)
  if (!ok) failures.push(label)
}

const origin = new URL(site).origin

console.log(`\n== Deployed frontend (${origin}) ==`)
const page = await fetch(site)
check('site responds 200', page.status === 200, String(page.status))
const html = await page.text()

const mainJs = html.match(/\/assets\/index-[\w-]+\.js/)?.[0]
const mainCss = html.match(/\/assets\/index-[\w-]+\.css/)?.[0]
check('entry script referenced', Boolean(mainJs), 'no /assets/index-*.js in HTML')
check('entry stylesheet referenced', Boolean(mainCss), 'no /assets/index-*.css in HTML')

if (mainJs) {
  const jsResponse = await fetch(`${origin}${mainJs}`)
  check('entry script served', jsResponse.status === 200, String(jsResponse.status))
  const js = await jsResponse.text()

  // The API host must be baked into the client bundle for live data to work.
  const apiHost = new URL(api).host
  check('API host baked into bundle', js.includes(apiHost), `${apiHost} not found in ${mainJs}`)
  check('lead endpoint wired', js.includes('/lead'), 'no /lead path in bundle')
}

console.log(`\n== CORS preflight from ${origin} ==`)
for (const [route, method] of [['forecast', 'GET'], ['chat', 'POST'], ['lead', 'POST']]) {
  const response = await fetch(`${api}/${route}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  const allow = response.headers.get('access-control-allow-origin')
  check(`${method} /${route} preflight`, response.status === 204 && allow === '*', `status ${response.status}, allow-origin ${allow}`)
}

console.log('\n== GET /forecast ==')
const forecast = await (await fetch(`${api}/forecast`)).json()
check('model reported', typeof forecast.model === 'string', String(forecast.model))
check('history has enough points for Holt-Winters', (forecast.history?.length ?? 0) >= 28, String(forecast.history?.length))
check('forecast window present', (forecast.forecast?.length ?? 0) > 0)
check(
  'every KPI the UI reads is finite',
  ['weekAheadUnits', 'weekAheadDeltaPct', 'previousWeekUnits', 'peakUnits', 'modelWape', 'unitsSavedPerDay', 'inventorySavingsCop'].every(
    (k) => Number.isFinite(forecast.kpis?.[k]),
  ),
)
check('peak day is a non-empty label', typeof forecast.kpis?.peakDay === 'string' && forecast.kpis.peakDay.length > 0)
check('model beats the baseline', forecast.metrics.wape < forecast.metrics.baselineWape)
check('no NaN leaked into labels', ![...forecast.history, ...forecast.forecast].some((p) => /NaN|undefined/.test(String(p.label))))

console.log('\n== POST /chat (es and en) ==')
for (const locale of ['es', 'en']) {
  const response = await fetch(`${api}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Which day should I stock up?', locale }),
  })
  const chat = await response.json()
  check(`${locale}: HTTP 200`, response.status === 200, String(response.status))
  check(`${locale}: reply present`, typeof chat.reply === 'string' && chat.reply.length > 0)
  check(`${locale}: locale echoed`, chat.locale === locale, String(chat.locale))
  check(`${locale}: reply has no undefined`, !/undefined|NaN/.test(chat.reply))
}

console.log('\n== POST /lead (honeypot path) ==')
const botResponse = await fetch(`${api}/lead`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Bot', email: 'b@b.com', company: 'B', role: 'R', challenge: 'C', website: 'http://spam.test' }),
})
const bot = await botResponse.json()
check('honeypot returns 201', botResponse.status === 201, String(botResponse.status))
check('honeypot does not email', bot.emailed === false)

console.log('\n== POST /lead (validation path) ==')
const badResponse = await fetch(`${api}/lead`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: '', email: 'not-an-email' }),
})
check('invalid payload rejected with 400', badResponse.status === 400, String(badResponse.status))

console.log(
  failures.length === 0
    ? '\nAll integration checks passed.'
    : `\n${failures.length} check(s) failed: ${failures.join(', ')}`,
)

process.exitCode = failures.length === 0 ? 0 : 1