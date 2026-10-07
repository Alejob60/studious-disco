'use strict'

/**
 * Persistence for real-data evaluations.
 *
 * The system stored nothing before this: the forecast Lambda computed and
 * discarded, the agent was stateless, and leads existed only as email. That is
 * fine for a demo and useless for a product, because a customer cannot be shown
 * how their own accuracy moved over time. This module is the first thing that
 * keeps a record.
 *
 * Storage is an existing MongoDB Atlas cluster, reached over its public endpoint
 * so no VPC, NAT gateway or new database is needed. It lives in its own
 * `atelier_predict` database rather than alongside the collections that already
 * exist there, so nothing here can collide with another project's data.
 *
 * Two rules shape the design:
 *
 *   - The client is injected, so the tests exercise the document shape and the
 *     failure paths without needing Atlas or a network.
 *   - Persistence never blocks the answer. A judge who uploads a CSV and gets an
 *     error because the database is unreachable has learned nothing about the
 *     product, so `save` reports failure and the handler still returns metrics.
 */

const DEFAULT_DB_NAME = 'atelier_predict'
const DEFAULT_COLLECTION = 'evaluations'

/**
 * Retention. Evaluation payloads hold a customer's actual sales series, so they
 * expire rather than accumulating. A TTL index on `createdAt` lets MongoDB do
 * the deletion without a cron function or a Lambda nobody remembers to run.
 */
const RETENTION_DAYS = 90

/**
 * Builds the stored document from a validated series and its report.
 *
 * Pure, so the shape is pinned by unit tests rather than discovered in a
 * database. The series itself is kept: without it the accuracy history cannot be
 * recomputed later, which is the whole reason this exists.
 */
function buildEvaluationDocument({ history, report, meta = {}, dataQuality = null, now = new Date() }) {
  const points = Array.isArray(history) ? history.length : 0

  return {
    createdAt: now,
    source: meta.source ?? 'api',
    locale: meta.locale ?? null,
    label: typeof meta.label === 'string' ? meta.label.slice(0, 120) : null,

    points,
    horizon: report.forecast?.length ?? null,
    model: report.model ?? 'holt-winters-additive',
    period: report.period ?? null,

    // The measured comparison against the naive baseline on this customer's data.
    metrics: {
      wape: report.metrics?.wape ?? null,
      baselineWape: report.metrics?.baselineWape ?? null,
      improvementPct: report.metrics?.improvementPct ?? null,
      mape: report.metrics?.mape ?? null,
      modelMaeUnits: report.metrics?.modelMaeUnits ?? null,
      baselineMaeUnits: report.metrics?.baselineMaeUnits ?? null,
      holdoutPoints: report.metrics?.holdoutPoints ?? null,
    },
    kpis: {
      peakDay: report.kpis?.peakDay ?? null,
      peakUnits: report.kpis?.peakUnits ?? null,
      weekAheadUnits: report.kpis?.weekAheadUnits ?? null,
      unitsSavedPerDay: report.kpis?.unitsSavedPerDay ?? null,
      inventorySavingsCop: report.kpis?.inventorySavingsCop ?? null,
    },

    // Kept with the measurement so a later accuracy review knows whether the
    // number was taken on data that had already been flagged. A WAPE computed over
    // a fortnight of stock-outs is a different fact from one computed over clean
    // data, and only the reader can say which they wanted.
    dataQuality: {
      reliable: dataQuality?.reliable ?? null,
      findings: Array.isArray(dataQuality?.findings) ? dataQuality.findings.map((f) => f.code) : [],
      longestZeroRun: dataQuality?.longestZeroRun ?? null,
      missingCalendarDays: dataQuality?.missingCalendarDays ?? null,
    },

    // Enough to chart the series again without re-reading the array.
    summary: {
      first: points > 0 ? history[0] : null,
      last: points > 0 ? history[points - 1] : null,
      mean: points > 0 ? round2(history.reduce((a, b) => a + b, 0) / points) : null,
      min: points > 0 ? Math.min(...history) : null,
      max: points > 0 ? Math.max(...history) : null,
    },

    series: Array.isArray(history) ? history.slice(0, 365) : [],
    forecast: Array.isArray(report.forecast) ? report.forecast : [],
  }
}

/**
 * Creates a persistence handle, or returns null when no URI is configured.
 *
 * The null return is what makes the fail-open path explicit: the caller asks for
 * a store and gets nothing back rather than an object that throws on every call.
 */
function createPersistence({ uri, dbName = DEFAULT_DB_NAME, collection = DEFAULT_COLLECTION, createClient, logger = console } = {}) {
  if (!uri) return null
  if (typeof createClient !== 'function') return null

  let clientPromise = null

  async function getCollection() {
    if (!clientPromise) {
      clientPromise = (async () => {
        const client = await createClient(uri)
        const db = client.db(dbName)
        const target = db.collection(collection)

        // Best effort: an index failure must not stop the write, it only means
        // retention is not enforced yet.
        try {
          await target.createIndex({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 86400, name: 'ttl_createdAt' })
        } catch (error) {
          logger.warn?.('[evaluate] could not create the TTL index', { message: error?.message })
        }

        return { client, collection: target }
      })().catch((error) => {
        // A rejected connect promise must not be cached, or one bad cold start
        // would disable persistence for the whole container lifetime.
        clientPromise = null
        throw error
      })
    }

    const { client, collection: target } = await clientPromise
    return { client, collection: target }
  }

  return {
    dbName,
    collection,
    retentionDays: RETENTION_DAYS,

    /** Returns the inserted id, or null when the write failed. */
    async save(document) {
      try {
        const { collection: target } = await getCollection()
        const result = await target.insertOne(document)
        return { ok: true, id: result.insertedId?.toString?.() ?? String(result.insertedId) }
      } catch (error) {
        logger.error?.('[evaluate] persistence failed, serving metrics anyway', {
          name: error?.name,
          message: String(error?.message ?? error).slice(0, 200),
        })
        return { ok: false, error: String(error?.name ?? 'store_error') }
      }
    },

    /** Cheap round trip, used by the health check and the integration suite. */
    async ping() {
      try {
        const { collection: target } = await getCollection()
        await target.findOne({}, { projection: { _id: 1 } })
        return { ok: true, dbName, collection }
      } catch (error) {
        return { ok: false, error: String(error?.name ?? 'store_error') }
      }
    },

    /**
     * Recent evaluations, newest first, without the stored series.
     *
     * The `series` field is deliberately not projected. This is a public endpoint
     * with no authentication, and a stored series is a customer's own sales
     * figures: the aggregates below are what a visitor needs to judge whether the
     * system measures anything, and the raw numbers are none of their business.
     */
    async listRecent(limit = 10) {
      try {
        const { collection: target } = await getCollection()
        const rows = await target
          .find({}, { projection: { series: 0, forecast: 0 } })
          .sort({ createdAt: -1 })
          .limit(clampLimit(limit))
          .toArray()

        return { ok: true, rows }
      } catch (error) {
        return { ok: false, error: String(error?.name ?? 'store_error'), rows: [] }
      }
    },

    /**
     * Aggregate accuracy across everything scored so far.
     *
     * The number worth having is `beatenBaselinePct`: of the series we have
     * measured, how many did the model actually beat the naive rule on. A single
     * percentage is a far more honest summary of a forecaster than any one WAPE,
     * because a model can look excellent on the series it was tuned against.
     */
    async summary() {
      try {
        const { collection: target } = await getCollection()

        const [row] = await target
          .aggregate([
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                beaten: {
                  $sum: { $cond: [{ $lt: ['$metrics.wape', '$metrics.baselineWape'] }, 1, 0] },
                },
                avgWape: { $avg: '$metrics.wape' },
                avgBaselineWape: { $avg: '$metrics.baselineWape' },
                avgImprovementPct: { $avg: '$metrics.improvementPct' },
                bestImprovementPct: { $max: '$metrics.improvementPct' },
                worstImprovementPct: { $min: '$metrics.improvementPct' },
                avgPoints: { $avg: '$points' },
                first: { $min: '$createdAt' },
                last: { $max: '$createdAt' },
              },
            },
          ])
          .toArray()

        if (!row) {
          return { ok: true, total: 0, beaten: 0, beatenBaselinePct: null }
        }

        return {
          ok: true,
          total: row.total,
          beaten: row.beaten,
          beatenBaselinePct: round2(row.total === 0 ? 0 : (row.beaten / row.total) * 100),
          avgWape: round2(row.avgWape),
          avgBaselineWape: round2(row.avgBaselineWape),
          avgImprovementPct: round2(row.avgImprovementPct),
          bestImprovementPct: round2(row.bestImprovementPct),
          worstImprovementPct: round2(row.worstImprovementPct),
          avgPoints: row.avgPoints === null ? null : Math.round(row.avgPoints),
          firstAt: row.first ?? null,
          lastAt: row.last ?? null,
        }
      } catch (error) {
        return { ok: false, error: String(error?.name ?? 'store_error') }
      }
    },
  }
}

function clampLimit(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 10
  return Math.min(Math.max(Math.trunc(parsed), 1), 50)
}

function round2(value) {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

module.exports = {
  buildEvaluationDocument,
  createPersistence,
  DEFAULT_DB_NAME,
  DEFAULT_COLLECTION,
  RETENTION_DAYS,
}