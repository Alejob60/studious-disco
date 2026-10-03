/**
 * Exports the canonical benchmark dataset so every forecast model is scored on
 * identical data.
 *
 * The challenger (TimesFM) runs in Python and cannot reimplement the Node PRNG
 * without risking a silent divergence. Instead Node writes the series and the
 * split, and the Python benchmark reads that file. A fair comparison requires
 * byte-identical inputs, so this is the only trustworthy way to produce one.
 *
 * Usage: node scripts/export-benchmark-dataset.mjs [outFile]
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const enginePath = resolve(process.cwd(), 'backend/shared/forecast-engine.js')
const { buildSyntheticHistory, backtest, wape, seasonalNaive } = require(enginePath)

const outFile = resolve(process.argv[2] ?? 'benchmarks/out/dataset.json')

const HISTORY_DAYS = 90
const HOLDOUT = 14
const SEED = 20260601

const history = buildSyntheticHistory({ days: HISTORY_DAYS, seed: SEED })
const train = history.slice(0, history.length - HOLDOUT)
const test = history.slice(history.length - HOLDOUT)

// Holt-Winters scored on exactly this split, so the challenger has a rival number
// produced by the same holdout rather than a number from a different experiment.
const champion = backtest(history, { holdout: HOLDOUT })
const baseline = {
  wape: wape(test, seasonalNaive(train, HOLDOUT)),
  predictions: seasonalNaive(train, HOLDOUT),
}

const dataset = {
  generatedAt: new Date().toISOString(),
  description:
    'Canonical benchmark dataset for the champion-challenger comparison. Both models must be scored on these exact values.',
  provenance: {
    generator: 'backend/shared/forecast-engine.js buildSyntheticHistory',
    seed: SEED,
    historyDays: HISTORY_DAYS,
    // mulberry32 with a fixed seed: reproducible on any machine, any Node version.
    deterministic: true,
  },
  split: {
    holdoutPoints: HOLDOUT,
    trainLength: train.length,
    testLength: test.length,
    rule: 'train = history[:-14], test = history[-14:]',
  },
  metric: 'WAPE (weighted absolute percentage error) on the holdout',
  series: {
    history,
    train,
    test,
  },
  champion: {
    name: 'holt-winters-additive',
    wapePct: Number((champion.modelWape * 100).toFixed(4)),
    maeUnits: Number(champion.modelMae.toFixed(4)),
    predictions: champion.predictions.map((value) => Number(value.toFixed(4))),
  },
  baseline: {
    name: 'seasonal-naive',
    wapePct: Number((baseline.wape * 100).toFixed(4)),
    predictions: baseline.predictions.map((value) => Number(value.toFixed(4))),
  },
  acceptanceRule: {
    note:
      'The challenger replaces the champion only if it beats the champion WAPE on this holdout. A tie does not qualify: it would add a 200M-parameter dependency and an App Runner service for no measured gain.',
    mustBeatWapePct: Number((champion.modelWape * 100).toFixed(4)),
  },
}

mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')

console.log(`Dataset written to ${outFile}`)
console.log(`  history      ${history.length} points`)
console.log(`  train        ${train.length}`)
console.log(`  test         ${test.length}`)
console.log(`  champion WAPE ${dataset.champion.wapePct}%`)
console.log(`  baseline WAPE ${dataset.baseline.wapePct}%`)
console.log(`  challenger must beat ${dataset.acceptanceRule.mustBeatWapePct}% to qualify`)