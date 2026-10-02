/**
 * Contract check between the deployed API and what the frontend reads.
 *
 * The dashboard is fed by `toChartPoints` / `toKpis` in src/lib/forecast-view.ts,
 * so a silent shape change in the Lambda would show up as a blank chart rather
 * than an error. This asserts the fields those two functions read actually exist.
 *
 * Usage: node scripts/verify-api.mjs [apiUrl]
 */

const apiUrl = (process.argv[2] ?? process.env.API_URL ?? '').replace(/\/$/, '')

if (!apiUrl) {
  console.error('Usage: node scripts/verify-api.mjs <apiUrl>')
  process.exit(1)
}

const failures = []

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok    ${label}`)
  } else {
    console.log(`  FAIL  ${label}${detail ? ` -> ${detail}` : ''}`)
    failures.push(label)
  }
}

const numberKeys = ['wape', 'baselineWape', 'mape', 'improvementPct', 'holdoutPoints', 'modelMaeUnits', 'baselineMaeUnits']
const kpiKeys = [
  'weekAheadUnits',
  'weekAheadDeltaPct',
  'previousWeekUnits',
  'peakDay',
  'peakUnits',
  'modelWape',
  'unitsSavedPerDay',
  'inventorySavingsCop',
]

console.log(`\nGET ${apiUrl}/forecast`)
const forecastResponse = await fetch(`${apiUrl}/forecast`)
check('HTTP 200', forecastResponse.status === 200, `got ${forecastResponse.status}`)
const data = await forecastResponse.json()

check('model present', typeof data.model === 'string' && data.model.length > 0, data.model)
check('history is a non-empty array', Array.isArray(data.history) && data.history.length > 0)
check('forecast is a non-empty array', Array.isArray(data.forecast) && data.forecast.length > 0)
check(
  'history entries have label/date/value',
  Array.isArray(data.history) && data.history.every((p) => typeof p.label === 'string' && typeof p.date === 'string' && Number.isFinite(p.value)),
)
check(
  'forecast entries have label/value/lower/upper',
  Array.isArray(data.forecast) && data.forecast.every((p) => Number.isFinite(p.value) && Number.isFinite(p.lower) && Number.isFinite(p.upper)),
)

for (const key of numberKeys) {
  check(`metrics.${key} is a number`, Number.isFinite(data.metrics?.[key]), String(data.metrics?.[key]))
}
for (const key of kpiKeys) {
  const value = data.kpis?.[key]
  const isNumeric = key === 'peakDay' ? typeof value === 'string' && value.length > 0 : Number.isFinite(value)
  check(`kpis.${key} is valid`, isNumeric, String(value))
}

check('WAPE beats the baseline', data.metrics.wape < data.metrics.baselineWape, `${data.metrics.wape} vs ${data.metrics.baselineWape}`)
check('confidence bands bracket the point forecast',
  data.forecast.every((p) => p.lower <= p.value && p.value <= p.upper))

console.log(`\nPOST ${apiUrl}/chat`)
const chatResponse = await fetch(`${apiUrl}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Confirma el pico de demanda en una frase.' }),
})
check('HTTP 200', chatResponse.status === 200, `got ${chatResponse.status}`)
const chat = await chatResponse.json()
check('reply is non-empty', typeof chat.reply === 'string' && chat.reply.length > 0)
check('actions is an array', Array.isArray(chat.actions))
check('usage reported', Number.isFinite(chat.usage?.inputTokens) && Number.isFinite(chat.usage?.outputTokens))

console.log(
  failures.length === 0
    ? '\nAll contract checks passed.'
    : `\n${failures.length} check(s) failed: ${failures.join(', ')}`,
)
// Set exitCode instead of calling process.exit(): forcing the exit while the
// fetch socket is still closing trips a libuv assertion on Windows.
process.exitCode = failures.length === 0 ? 0 : 1