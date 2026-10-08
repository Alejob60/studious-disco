const test = require('node:test')
const assert = require('node:assert/strict')

const { createPersistence, buildEvaluationDocument } = require('../shared/evaluation-store.js')

/**
 * The history endpoint is public and unauthenticated, so two things matter more
 * than the numbers: the raw series must never leave, and an empty database must
 * read as empty rather than broken.
 */

/** Just the metrics block, which is what the aggregate reads out of a document. */
const METRICS = (wape, baselineWape) => ({
  wape,
  baselineWape,
  improvementPct: ((baselineWape - wape) / baselineWape) * 100,
  mape: 9,
  modelMaeUnits: 12,
  baselineMaeUnits: 15,
  holdoutPoints: 14,
})

const REPORT = (wape, baselineWape) => ({
  model: 'holt-winters-additive',
  period: 7,
  metrics: METRICS(wape, baselineWape),
  kpis: { peakDay: 'x', peakUnits: 200, weekAheadUnits: 100, unitsSavedPerDay: 3, inventorySavingsUsd: 1 },
  forecast: [{ label: 'a', value: 1 }],
})

/** A collection stub that records the pipeline and can run a trivial group. */
function fakeCollection(rows) {
  const calls = { findOptions: null, limit: null, projection: null }
  return {
    calls,
    async createIndex() { return 'ok' },
    async insertOne() { return { insertedId: 'x' } },
    async findOne() { return { _id: 'x' } },
    find(filter, options) {
      calls.findOptions = options
      calls.projection = options?.projection
      return {
        sort() { return this },
        limit(n) { calls.limit = n; return this },
        async toArray() { return rows },
      }
    },
    aggregate(pipeline) {
      calls.pipeline = pipeline
      const compute = () => {
        if (rows.length === 0) return []
        const beaten = rows.filter((r) => r.metrics.wape < r.metrics.baselineWape).length
        return [{
          _id: null,
          total: rows.length,
          beaten,
          avgWape: rows.reduce((a, r) => a + r.metrics.wape, 0) / rows.length,
          avgBaselineWape: rows.reduce((a, r) => a + r.metrics.baselineWape, 0) / rows.length,
          avgImprovementPct: rows.reduce((a, r) => a + r.metrics.improvementPct, 0) / rows.length,
          bestImprovementPct: Math.max(...rows.map((r) => r.metrics.improvementPct)),
          worstImprovementPct: Math.min(...rows.map((r) => r.metrics.improvementPct)),
          avgPoints: rows.reduce((a, r) => a + r.points, 0) / rows.length,
          first: rows[rows.length - 1].createdAt,
          last: rows[0].createdAt,
        }]
      }
      return { async toArray() { return compute() } }
    },
  }
}

const rows = [
  { _id: 'a', createdAt: new Date('2026-10-06T10:00:00Z'), source: 'edit', locale: 'en', points: 196, horizon: 14, metrics: METRICS(10.4, 14.32), kpis: { peakUnits: 184 }, summary: { mean: 112.19, max: 234 }, series: [1, 2, 3] },
  { _id: 'b', createdAt: new Date('2026-10-05T10:00:00Z'), source: 'sample', locale: 'es', points: 60, horizon: 14, metrics: METRICS(7.1, 9.0), kpis: { peakUnits: 90 }, summary: { mean: 80, max: 120 }, series: [4, 5] },
  { _id: 'c', createdAt: new Date('2026-10-04T10:00:00Z'), source: 'integration', locale: null, points: 30, horizon: 14, metrics: METRICS(12.0, 11.5), kpis: { peakUnits: 40 }, summary: { mean: 60, max: 70 }, series: [6] },
]

function storeOver(collection) {
  return createPersistence({
    uri: 'mongodb://example',
    createClient: async () => ({ db: () => ({ collection: () => collection }) }),
  })
}

test('listRecent excludes the stored series', async () => {
  const collection = fakeCollection(rows)
  const result = await storeOver(collection).listRecent(5)

  assert.equal(result.ok, true)
  assert.equal(result.rows.length, 3)
  // The projection is the privacy control, so it is asserted rather than assumed.
  assert.deepEqual(collection.calls.projection, { series: 0, forecast: 0 })
  assert.equal(collection.calls.limit, 5)
})

test('the limit is bounded so the endpoint cannot be asked for everything', async () => {
  const collection = fakeCollection(rows)
  const store = storeOver(collection)

  await store.listRecent(9999)
  assert.equal(collection.calls.limit, 50)

  await store.listRecent(0)
  assert.equal(collection.calls.limit, 1)

  await store.listRecent('abc')
  assert.equal(collection.calls.limit, 10)
})

test('summary reports how often the model actually beat the baseline', async () => {
  const summary = await storeOver(fakeCollection(rows)).summary()

  assert.equal(summary.ok, true)
  assert.equal(summary.total, 3)
  // Row `c` is a loss, so two of three is the honest figure.
  assert.equal(summary.beaten, 2)
  assert.equal(summary.beatenBaselinePct, 66.67)
  // (27.37 + 21.11 - 4.35) / 3. The average includes the series the model lost,
  // which is what keeps it from being a number chosen to look good.
  assert.equal(summary.avgImprovementPct, 14.71)
  assert.equal(summary.worstImprovementPct, -4.35)
  assert.equal(summary.avgPoints, 95)
})

test('an empty database reads as empty, not as a failure', async () => {
  const summary = await storeOver(fakeCollection([])).summary()
  assert.equal(summary.ok, true)
  assert.equal(summary.total, 0)
  // Null, not 0: "we beat the baseline 0 % of the time" is a claim, and there is
  // nothing to claim when nothing has been scored.
  assert.equal(summary.beatenBaselinePct, null)
})

test('a failing query is reported, not silently returned as zero', async () => {
  const collection = fakeCollection(rows)
  collection.aggregate = () => { throw new Error('pipeline exploded') }
  const summary = await storeOver(collection).summary()

  assert.equal(summary.ok, false)
  assert.ok(summary.error)
})

test('a failing read returns an empty list rather than throwing', async () => {
  const collection = fakeCollection(rows)
  collection.find = () => { throw new Error('socket closed') }
  const result = await storeOver(collection).listRecent(5)

  assert.equal(result.ok, false)
  assert.deepEqual(result.rows, [])
})

test('the summary groups once rather than pulling documents into the function', async () => {
  const collection = fakeCollection(rows)
  await storeOver(collection).summary()

  const [stage] = collection.calls.pipeline
  assert.equal(stage.$group._id, null)
  assert.ok(stage.$group.total)
  // The comparison has to be computed in the database: doing it in the Lambda
  // would mean reading every stored document across the wire.
  assert.deepEqual(stage.$group.beaten.$sum.$cond[0].$lt, ['$metrics.wape', '$metrics.baselineWape'])
})

test('the document the summary reads is the one the writer stored', () => {
  const doc = buildEvaluationDocument({ history: [10, 20, 30], report: REPORT(8, 12) })
  assert.equal(doc.points, 3)
  assert.equal(doc.metrics.wape, 8)
  assert.equal(doc.summary.mean, 20)
})
