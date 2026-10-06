const test = require('node:test')
const assert = require('node:assert/strict')

const { buildEvaluationDocument, createPersistence, RETENTION_DAYS } = require('../shared/evaluation-store.js')

/**
 * Persistence is the piece that has to be provable without a database, so the
 * Mongo client is injected. These tests cover the two things that actually matter
 * for the demo: the document keeps the evidence, and a broken store degrades
 * instead of throwing.
 */

const REPORT = {
  model: 'holt-winters-additive',
  period: 7,
  metrics: { wape: 8.1, baselineWape: 10.4, improvementPct: 22.1, mape: 9.2, modelMaeUnits: 12, baselineMaeUnits: 15, holdoutPoints: 14 },
  kpis: { peakDay: 'Mié 14', peakUnits: 240, weekAheadUnits: 1300, unitsSavedPerDay: 3, inventorySavingsCop: 1665000 },
  forecast: [{ label: 'Mié 15', value: 200, lower: 180, upper: 220 }],
}

function fakeMongo({ failOn = null } = {}) {
  const calls = { index: [], insert: [] }
  const collection = {
    async createIndex(spec, options) {
      calls.index.push({ spec, options })
      return 'ttl_createdAt'
    },
    async insertOne(doc) {
      calls.insert.push(doc)
      if (failOn === 'insert') throw Object.assign(new Error('not primary'), { name: 'MongoServerError' })
      return { insertedId: 'abc123' }
    },
    async findOne() {
      if (failOn === 'find') throw Object.assign(new Error('no primary'), { name: 'MongoServerError' })
      return { _id: 'abc123' }
    },
  }

  return {
    calls,
    client: { db: () => ({ collection: () => collection }) },
  }
}

test('the stored document keeps the series and the measured comparison', () => {
  const history = [10, 20, 30, 40]
  const doc = buildEvaluationDocument({ history, report: REPORT, meta: { source: 'upload', locale: 'es', label: 'Tienda 7' } })

  assert.equal(doc.points, 4)
  assert.equal(doc.source, 'upload')
  assert.equal(doc.label, 'Tienda 7')
  assert.deepEqual(doc.series, [10, 20, 30, 40])
  // Without these two the accuracy history cannot be recomputed later.
  assert.equal(doc.metrics.wape, 8.1)
  assert.equal(doc.metrics.baselineWape, 10.4)
  assert.equal(doc.model, 'holt-winters-additive')
})

test('the document summarises the series so a chart needs no second read', () => {
  const doc = buildEvaluationDocument({ history: [10, 20, 30, 40], report: REPORT })
  assert.equal(doc.summary.first, 10)
  assert.equal(doc.summary.last, 40)
  assert.equal(doc.summary.min, 10)
  assert.equal(doc.summary.max, 40)
  assert.equal(doc.summary.mean, 25)
})

test('a long label is capped and an odd meta block does not throw', () => {
  const long = buildEvaluationDocument({ history: [1], report: REPORT, meta: { label: 'x'.repeat(400) } })
  assert.equal(long.label.length, 120)
  assert.doesNotThrow(() => buildEvaluationDocument({ history: null, report: {} }))
  assert.equal(buildEvaluationDocument({ history: null, report: {} }).points, 0)
})

test('a save returns the id and a read-back works', async () => {
  const mongo = fakeMongo()
  const store = createPersistence({ uri: 'mongodb://example', createClient: async () => mongo.client })
  assert.equal(store.dbName, 'atelier_predict')

  const saved = await store.save(buildEvaluationDocument({ history: [1, 2], report: REPORT }))
  assert.deepEqual(saved, { ok: true, id: 'abc123' })
  assert.deepEqual(await store.ping(), { ok: true, dbName: 'atelier_predict', collection: 'evaluations' })
})

test('retention is enforced with a TTL index, not a cron function', async () => {
  const mongo = fakeMongo()
  const store = createPersistence({ uri: 'mongodb://example', createClient: async () => mongo.client })
  await store.save(buildEvaluationDocument({ history: [1], report: REPORT }))

  const [index] = mongo.calls.index
  assert.deepEqual(index.spec, { createdAt: 1 })
  assert.equal(index.options.expireAfterSeconds, RETENTION_DAYS * 86400)
})

test('a failing write reports failure instead of throwing', async () => {
  const mongo = fakeMongo({ failOn: 'insert' })
  const store = createPersistence({ uri: 'mongodb://example', createClient: async () => mongo.client })

  // The handler must still be able to return metrics after this.
  const saved = await store.save(buildEvaluationDocument({ history: [1], report: REPORT }))
  assert.equal(saved.ok, false)
  assert.equal(saved.error, 'MongoServerError')

  // The connection itself is healthy, and ping says so. Keeping the two apart is
  // the point: `persisted: false` with a reachable store is a write problem,
  // while an unreachable store is reported by the handler as never configured.
  assert.equal((await store.ping()).ok, true)
})

test('an unreachable store fails the read too', async () => {
  const mongo = fakeMongo({ failOn: 'find' })
  const store = createPersistence({ uri: 'mongodb://example', createClient: async () => mongo.client })
  assert.equal((await store.ping()).ok, false)
})

test('a failed connection is not cached, so one bad cold start does not disable the store', async () => {
  let attempts = 0
  const mongo = fakeMongo()
  const store = createPersistence({
    uri: 'mongodb://example',
    createClient: async () => {
      attempts += 1
      if (attempts === 1) throw new Error('handshake failed')
      return mongo.client
    },
  })

  assert.equal((await store.save({})).ok, false)
  assert.equal(attempts, 1)
  // Second attempt must retry rather than replay the cached rejection.
  assert.equal((await store.save({})).ok, true)
  assert.equal(attempts, 2)
})

test('no store is configured when there is no URI', async () => {
  assert.equal(createPersistence({ uri: '' }), null)
  assert.equal(createPersistence({}), null)
  assert.equal(createPersistence({ uri: 'mongodb://x' }), null)
})