/**
 * End-to-end integration check between the deployed frontend and the API.
 *
 * Covers the parts a browser would exercise that a unit test cannot: that the
 * shipped bundle points at the live API, that CORS preflight passes for the real
 * Amplify origin, and that all three endpoints satisfy the contract the UI reads.
 *
 * Usage: node scripts/verify-integration.mjs [siteUrl] [apiUrl]
 */

import { ROUTES } from './routes.mjs'

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

console.log('\n== Deep links: every sitemap URL survives a refresh ==')
// The failure this guards against is real and was invisible here: with the
// Amplify rewrite `/*` -> `/index.html` saved on the app, `/es` answered 200
// because the build emitted a real file for it, while all eight legal routes
// answered 404. Nothing in this script requested them, so the suite stayed green
// on a site where every policy page was broken.
const sitemapResponse = await fetch(`${origin}/sitemap.xml`)
check('sitemap served', sitemapResponse.status === 200, String(sitemapResponse.status))
const sitemap = await sitemapResponse.text()
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, url]) => url)

check(
  'sitemap lists exactly the routes the build emits',
  sitemapUrls.length === ROUTES.length,
  `sitemap has ${sitemapUrls.length}, manifest has ${ROUTES.length}`,
)

for (const url of sitemapUrls) {
  // Redirects are followed on purpose. Static hosting answers `/es` with a 301 to
  // `/es/` because the emitted artefact is a directory index, and that is correct
  // behaviour; what matters is that the refresh lands on the page, not on a 404.
  const response = await fetch(url)
  const landed = new URL(response.url || url).pathname
  check(
    `deep link ${new URL(url).pathname}`,
    response.status === 200,
    `landed on ${landed} with status ${response.status}`,
  )
}

console.log(`\n== CORS preflight from ${origin} ==`)
// Node's fetch sends no Origin header unless asked, so these requests used to be
// indistinguishable from a browser's and the suite could not tell a working CORS
// configuration from a broken one. Both the preflight and the real calls below now
// carry the origin, which is what makes this a test of the browser path.
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
  check(
    `${method} /${route} preflight allows this origin`,
    response.status === 204 && allow === origin,
    `status ${response.status}, allow-origin ${allow}`,
  )
}

// A wildcard would mean the restriction is not actually in force.
const wildcardProbe = await fetch(`${api}/forecast`, {
  method: 'OPTIONS',
  headers: {
    Origin: 'https://attacker.example',
    'Access-Control-Request-Method': 'GET',
  },
})
check(
  'a foreign origin is not granted access',
  wildcardProbe.headers.get('access-control-allow-origin') !== '*',
  `allow-origin ${wildcardProbe.headers.get('access-control-allow-origin')}`,
)

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
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ message: 'Which day should I stock up?', locale }),
  })
  const chat = await response.json()
  check(`${locale}: HTTP 200`, response.status === 200, String(response.status))
  check(`${locale}: reply present`, typeof chat.reply === 'string' && chat.reply.length > 0)
  check(`${locale}: locale echoed`, chat.locale === locale, String(chat.locale))
  check(`${locale}: reply has no undefined`, !/undefined|NaN/.test(chat.reply))
  // A browser refuses the response without this header, so a 200 that lacks it is
  // a broken chat box even though the API answered.
  check(
    `${locale}: browser would accept the response`,
    response.headers.get('access-control-allow-origin') === origin,
    `allow-origin ${response.headers.get('access-control-allow-origin')}`,
  )
}

console.log('\n== POST /lead (honeypot path) ==')
const botResponse = await fetch(`${api}/lead`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ name: 'Bot', email: 'b@b.com', company: 'B', role: 'R', challenge: 'C', website: 'http://spam.test' }),
})
const bot = await botResponse.json()
check('honeypot returns 201', botResponse.status === 201, String(botResponse.status))
check('honeypot does not email', bot.emailed === false)

console.log('\n== POST /lead (validation path) ==')
const badResponse = await fetch(`${api}/lead`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ name: '', email: 'not-an-email' }),
})
check('invalid payload rejected with 400', badResponse.status === 400, String(badResponse.status))

console.log('\n== POST /evaluate (a visitor scoring their own series) ==')
// The downloadable sample is the file the landing page hands over, so fetching it
// from the live site means this check exercises the same bytes a visitor gets.
const sampleResponse = await fetch(`${origin}/sample-demand.csv`)
check('sample CSV is downloadable', sampleResponse.status === 200, String(sampleResponse.status))
const sampleCsv = await sampleResponse.text()

const evaluated = await (
  await fetch(`${api}/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify({ csv: sampleCsv, source: 'integration', locale: 'en' }),
  })
).json()
check('evaluate returns 200', evaluated.ok === true, JSON.stringify(evaluated).slice(0, 160))
check('evaluate scored the uploaded series', evaluated.points > 28, String(evaluated.points))
check('evaluate reports both WAPEs', typeof evaluated.metrics?.wape === 'number' && typeof evaluated.metrics?.baselineWape === 'number')
check('the model beats the baseline on this series', evaluated.metrics.wape < evaluated.metrics.baselineWape)
check('evaluate projects a horizon', (evaluated.forecast?.length ?? 0) === evaluated.horizon)
// `persisted` is the claim that matters most: without a record this is a demo,
// with one it is a system that can show a customer their own accuracy over time.
check('the evaluation was recorded', evaluated.persistence?.persisted === true, JSON.stringify(evaluated.persistence))

const shortResponse = await fetch(`${api}/evaluate`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: origin },
  body: JSON.stringify({ csv: '1\n2\n3' }),
})
const short = await shortResponse.json()
check('a too-short series is refused with 400', shortResponse.status === 400, String(shortResponse.status))
check('the refusal names the problem', short.error === 'too_short', String(short.error))

console.log(
  failures.length === 0
    ? '\nAll integration checks passed.'
    : `\n${failures.length} check(s) failed: ${failures.join(', ')}`,
)

process.exitCode = failures.length === 0 ? 0 : 1