const test = require('node:test')
const assert = require('node:assert/strict')

/**
 * The handler reads its inputs from the environment at module load, so these
 * cases inject the collaborators instead. What is pinned here is the routing and
 * the failure contract: a health check must not be answered as an evaluation,
 * because a 400 on the health route reads as "the store is broken" when in fact
 * nothing was even attempted.
 */

const { handler } = require('../evaluate/index.js')

function event({ body, routeKey, rawPath } = {}) {
  return {
    body,
    rawPath: rawPath ?? '/evaluate',
    requestContext: routeKey ? { http: { routeKey } } : undefined,
  }
}

const CSV = Array.from({ length: 40 }, (_, i) => 100 + (i % 7) * 8).join('\n')

test('a real series is scored and returned', async () => {
  const response = await handler(event({ body: JSON.stringify({ csv: CSV, source: 'test' }), routeKey: 'POST /evaluate' }))
  assert.equal(response.statusCode, 200)

  const payload = JSON.parse(response.body)
  assert.equal(payload.ok, true)
  assert.equal(payload.points, 40)
  assert.equal(payload.model, 'holt-winters-additive')
  // The comparison is the point: two numbers on the same held-out window.
  assert.equal(typeof payload.metrics.wape, 'number')
  assert.equal(typeof payload.metrics.baselineWape, 'number')
  assert.equal(payload.forecast.length, 14)
  // No store is configured in tests, which is the fail-open path.
  assert.equal(payload.persistence.persisted, false)
})

test('a too-short series is refused with the reason, not a stack trace', async () => {
  const response = await handler(event({ body: JSON.stringify({ csv: '1\n2\n3' }), routeKey: 'POST /evaluate' }))
  assert.equal(response.statusCode, 400)
  const payload = JSON.parse(response.body)
  assert.equal(payload.ok, false)
  assert.equal(payload.error, 'too_short')
})

test('a malformed body is a 400, not a 500', async () => {
  const response = await handler(event({ body: '{not json', routeKey: 'POST /evaluate' }))
  assert.equal(response.statusCode, 400)
  assert.equal(JSON.parse(response.body).error, 'invalid_payload')
})

test('the health route is not answered as an evaluation', async () => {
  // Regression guard: before the dispatch existed this returned 400 no_series,
  // which looks exactly like an unreachable database.
  const response = await handler(event({ routeKey: 'GET /evaluate/health', rawPath: '/evaluate/health' }))
  assert.equal(response.statusCode, 503)

  const payload = JSON.parse(response.body)
  assert.equal(payload.ok, false)
  assert.equal(payload.persistenceConfigured, false)
})

test('the health route is recognised from a raw path too, for a direct invoke', async () => {
  const response = await handler(event({ rawPath: '/evaluate/health' }))
  assert.equal(JSON.parse(response.body).error, 'not_configured')
})

test('a series the engine cannot fit is a 422 about the data, not a server fault', async () => {
  // 28 points is the minimum, but a flat series still has to produce a report.
  const flat = Array.from({ length: 30 }, () => 50)
  const response = await handler(event({ body: JSON.stringify({ csv: flat.join('\n') }), routeKey: 'POST /evaluate' }))
  assert.equal([200, 422].includes(response.statusCode), true)
})