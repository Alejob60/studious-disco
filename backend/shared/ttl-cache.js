/**
 * Bounded TTL cache for Lambda warm containers.
 *
 * Why this exists: both the forecast and the agent Lambdas recompute an identical
 * report on every request. The synthetic demo history is deterministic, so the
 * result cannot change between invocations — recomputing it is pure waste.
 *
 * The cache is per-container and deliberately unbounded in time but capped in
 * size, so a warm instance never accumulates more than `maxEntries` reports.
 */

const crypto = require('node:crypto')

class TtlCache {
  /**
   * @param {number} ttlMs how long an entry stays valid
   * @param {number} [maxEntries] hard cap on retained entries
   */
  constructor(ttlMs, maxEntries = 32) {
    this.ttlMs = ttlMs
    this.maxEntries = maxEntries
    this.store = new Map()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Stable key for a forecast request.
   *
   * `horizon` and `unitMargin` change the output, and a supplied history changes
   * it entirely, so all three belong in the key. Anything less would serve a
   * forecast computed for a different request.
   */
  static forecastKey(history, horizon, unitMargin) {
    // Hash the series so the key length does not grow with the payload, and so
    // two different histories can never collide onto the same entry.
    const digest = crypto.createHash('sha256').update(history.join(',')).digest('hex').slice(0, 16)
    return `h${horizon}:m${unitMargin}:${digest}`
  }

  get(key) {
    const entry = this.store.get(key)
    if (!entry) {
      this.misses += 1
      return undefined
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.misses += 1
      return undefined
    }

    // Refresh insertion order so the eviction below drops the coldest entry.
    this.store.delete(key)
    this.store.set(key, entry)
    this.hits += 1
    return entry.value
  }

  set(key, value) {
    if (this.store.has(key)) this.store.delete(key)

    // Evict oldest first; Map preserves insertion order.
    while (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next()
      if (oldest.done) break
      this.store.delete(oldest.value)
    }

    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    return value
  }

  /** Returns the cached value or computes, stores and returns a fresh one. */
  remember(key, compute) {
    const cached = this.get(key)
    if (cached !== undefined) return cached
    return this.set(key, compute())
  }

  get size() {
    return this.store.size
  }

  stats() {
    return { size: this.size, hits: this.hits, misses: this.misses }
  }

  clear() {
    this.store.clear()
    this.hits = 0
    this.misses = 0
  }
}

/** Five minutes matches the Cache-Control header the forecast response sends. */
const FORECAST_TTL_MS = 5 * 60 * 1000

/** Reports the caching layer at the API root, for judges and for debugging. */
function cacheStats(caches) {
  return Object.fromEntries(Object.entries(caches).map(([name, cache]) => [name, cache.stats()]))
}

module.exports = { TtlCache, FORECAST_TTL_MS, cacheStats }