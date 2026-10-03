const test = require('node:test')
const assert = require('node:assert/strict')
const { describeApi, ENDPOINTS } = require('../shared/service-info.js')

const EVENT_ROOT = {
  requestContext: { http: { routeKey: 'GET /' } },
  headers: { host: 'abc123.execute-api.us-east-1.amazonaws.com' },
}

test('the index names the service, model and status', () => {
  const index = describeApi('https://abc123.execute-api.us-east-1.amazonaws.com')

  assert.equal(index.service, 'Atelier Predict API')
  assert.equal(index.status, 'operational')
  assert.equal(index.model.name, 'holt-winters-additive')
  assert.equal(index.model.period, 7)
  assert.equal(index.model.holdoutPoints, 14)
})

test('the index documents every endpoint the API actually serves', () => {
  const index = describeApi('')
  const declared = index.endpoints.map((e) => `${e.method} ${e.path}`).sort()

  assert.deepEqual(declared, ['GET /forecast', 'POST /chat', 'POST /lead'])
  assert.equal(declared.length, ENDPOINTS.length)
})

test('accuracy claims in the index match the model', () => {
  const index = describeApi('')

  // These are the numbers asserted by the integration check against the live API.
  // If the model changes, this test and the README must change together.
  assert.ok(index.accuracy.model < index.accuracy.baselineSeasonalNaive)
  assert.equal(index.accuracy.model, 7.77)
  assert.equal(index.accuracy.baselineSeasonalNaive, 10.17)
})

test('the index states its own caveats instead of hiding them', () => {
  const index = describeApi('')

  assert.ok(index.caveats.length >= 3)
  assert.ok(index.caveants === undefined)
  assert.ok(index.caveats.some((c) => /synthetic/i.test(c)))
  assert.ok(index.caveats.some((c) => /unauthenticated/i.test(c)))
})

test('agent-surface links point at the frontend, not at this API', () => {
  const index = describeApi('https://abc123.execute-api.us-east-1.amazonaws.com')

  // llms.txt, robots.txt and sitemap.xml are served by Amplify. Pointing them
  // at the API origin produced 404s, so the host is asserted here.
  for (const key of ['llms', 'robots', 'sitemap']) {
    assert.ok(
      index.agentSurface[key].startsWith('https://main.d28ukybtuih8pa.amplifyapp.com/'),
      `${key} must point at the frontend host, got ${index.agentSurface[key]}`,
    )
    assert.ok(!index.agentSurface[key].includes('execute-api'), `${key} must not point at the API host`)
  }

  assert.equal(index.thisApi, 'https://abc123.execute-api.us-east-1.amazonaws.com')
})

test('the index warns about the POST-only endpoints', () => {
  const index = describeApi('')
  assert.ok(index.caveats.some((c) => /POST only/i.test(c)))
})

test('an empty origin degrades without throwing', () => {
  const index = describeApi('')
  assert.equal(index.thisApi, null)
  assert.ok(index.endpoints.length > 0)
})

test('every endpoint declares a method and a path', () => {
  for (const endpoint of ENDPOINTS) {
    assert.match(endpoint.method, /^(GET|POST)$/)
    assert.ok(endpoint.path.startsWith('/'))
    assert.ok(endpoint.description.length > 20, 'each endpoint needs a usable description')
  }
})