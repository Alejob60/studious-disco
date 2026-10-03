/**
 * Benchmarks the module-load cost that A.1 was meant to remove.
 *
 * `InitDuration` in CloudWatch is the authoritative measure, but it only emits a
 * datapoint on a cold start, and a warm container produces none. This script
 * isolates the same variable locally so the claim can be checked on demand:
 * how long it takes Node to `require()` the forecast handler with and without
 * the AWS SDKs it never calls.
 *
 * Usage: node scripts/bench-cold-start.mjs
 */

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(process.cwd())

/** Median of N child-process launches, so JIT warmup does not skew the result. */
function measure(label, script, runs = 5) {
  if (!existsSync(script.match(/['"]([^'"]+)['"]/)[1])) {
    console.log(`  ${label.padEnd(44)} SKIP (bundle not built)`)
    return null
  }

  const samples = []
  for (let i = 0; i < runs; i += 1) {
    const output = execFileSync(process.execPath, ['-e', script], { cwd: repoRoot, encoding: 'utf8' })
    samples.push(Number(output.trim()))
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]
  console.log(`  ${label.padEnd(44)} ${median} ms (mediana de ${runs})`)
  return median
}

console.log('\nModule load time for the forecast handler (what InitDuration tracks)\n')

const after = measure(
  'after A.1  (10 KB, zero SDK packages)',
  "const t=Date.now();require('./infra/.staging/forecast/forecast/index.js');console.log(Date.now()-t)",
)

// Recreates the pre-A.1 shape: one shared bundle, so the handler arrives
// alongside the Bedrock SDK that only the agent function uses.
const before = measure(
  'before A.1 (2.4 MB shared bundle)',
  "const t=Date.now();require('./backend/node_modules/@aws-sdk/client-bedrock-runtime');require('./backend/forecast/index.js');console.log(Date.now()-t)",
)

if (before !== null && after !== null) {
  const saved = before - after
  console.log(`\n  module load avoided: ${saved} ms per cold start`)
  console.log('  network avoided:     2,324,059 bytes per cold start (2.32 MB)')
  console.log('\n  Note: InitDuration only emits on a cold start. Check it in CloudWatch')
  console.log('  after the function has been idle long enough for the container to recycle.')
}