const test = require('node:test')
const assert = require('node:assert/strict')
const { TtlCache } = require('../shared/ttl-cache.js')

test('a fresh cache misses and a second read hits', () => {
  const cache = new TtlCache(1000)
  let calls = 0

  const compute = () => {
    calls += 1
    return { value: 42 }
  }

  const first = cache.remember('k', compute)
  const second = cache.remember('k', compute)

  assert.deepEqual(first, { value: 42 })
  assert.deepEqual(second, { value: 42 })
  assert.equal(calls, 1, 'compute must run once')
  assert.deepEqual(cache.stats(), { size: 1, hits: 1, misses: 1 })
})

test('entries expire once the ttl passes', () => {
  const cache = new TtlCache(1)
  cache.set('k', 'v')

  // Force expiry rather than sleeping, so the suite stays fast.
  cache.store.get('k').expiresAt = Date.now() - 1

  assert.equal(cache.get('k'), undefined)
  assert.equal(cache.size, 0, 'expired entries are dropped on read')
})

test('the cache is bounded and evicts the coldest entry', () => {
  const cache = new TtlCache(10_000, 2)

  cache.set('a', 1)
  cache.set('b', 2)
  cache.set('c', 3)

  assert.equal(cache.size, 2)
  assert.equal(cache.get('a'), undefined, 'oldest entry evicted')
  assert.equal(cache.get('b'), 2)
  assert.equal(cache.get('c'), 3)
})

test('reading an entry refreshes its recency', () => {
  const cache = new TtlCache(10_000, 2)

  cache.set('a', 1)
  cache.set('b', 2)
  cache.get('a') // 'a' becomes the newest
  cache.set('c', 3)

  assert.equal(cache.get('a'), 1, 'recently read entry survives')
  assert.equal(cache.get('b'), undefined, 'coldest entry evicted instead')
})

test('forecast keys differ on every input that changes the output', () => {
  const history = [1, 2, 3, 4, 5]

  const base = TtlCache.forecastKey(history, 14, 18500)
  assert.equal(base, TtlCache.forecastKey([...history], 14, 18500), 'same input, same key')

  assert.notEqual(base, TtlCache.forecastKey(history, 7, 18500), 'horizon matters')
  assert.notEqual(base, TtlCache.forecastKey(history, 14, 20000), 'margin matters')
  assert.notEqual(base, TtlCache.forecastKey([...history, 6], 14, 18500), 'history matters')
})

test('different histories cannot collide on a short key', () => {
  // The digest is truncated to 16 hex chars, so this guards the truncation.
  const a = TtlCache.forecastKey([1, 2, 3], 14, 18500)
  const b = TtlCache.forecastKey([1, 2, 4], 14, 18500)
  assert.notEqual(a, b)
  assert.equal(a.length, 'h14:m18500:'.length + 16)
})

test('a huge history does not produce a huge key', () => {
  const huge = Array.from({ length: 100_000 }, (_, i) => i)
  const key = TtlCache.forecastKey(huge, 14, 18500)
  assert.ok(key.length < 40, `key should stay short, got ${key.length}`)
})

test('cached falsy values are not treated as misses', () => {
  const cache = new TtlCache(1000)
  cache.set('zero', 0)
  cache.set('empty', '')
  cache.set('false', false)

  assert.equal(cache.get('zero'), 0)
  assert.equal(cache.get('empty'), '')
  assert.equal(cache.get('false'), false)
})

test('clear resets entries and counters', () => {
  const cache = new TtlCache(1000)
  cache.set('a', 1)
  cache.get('a')

  cache.clear()

  assert.equal(cache.size, 0)
  assert.deepEqual(cache.stats(), { size: 0, hits: 0, misses: 0 })
})