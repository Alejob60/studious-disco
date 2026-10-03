/**
 * Builds one deployable bundle per Lambda function.
 *
 * Why: a single shared zip made the forecast function download 2.4 MB to execute
 * 18 KB of code, because it shipped the Bedrock and Secrets Manager SDKs it never
 * touches. Forecast runs on the hot path (every page load), so that waste was paid
 * on every cold start.
 *
 * Each bundle contains only the packages reachable from its entry point. The
 * dependency walk reads `dependencies` from each package's manifest, so it stays
 * correct as long as npm keeps hoisting to a flat `node_modules`.
 *
 * Usage: node scripts/bundle-functions.mjs [backendDir] [outDir]
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { builtinModules } from 'node:module'

const backendDir = resolve(process.argv[2] ?? 'backend')
const outDir = resolve(process.argv[3] ?? 'infra/.staging')

// The S3 SDK adds roughly 2 MB to the forecast bundle, which is the one function
// whose cold start was optimised down to a few kilobytes. The challenger read is
// guarded by FORECAST_BUCKET, so the SDK is only packaged when that pipeline is
// actually being deployed:
//   node scripts/bundle-functions.mjs                       champion only (default)
//   node scripts/bundle-functions.mjs backend out --with-s3   challenger enabled
const withS3 = process.argv.includes('--with-s3')
const rootModules = join(backendDir, 'node_modules')

// entry is relative to the bundle root; shared is copied into every bundle.
const FUNCTIONS = [
  {
    name: 'forecast',
    entry: 'forecast/index.js',
    needsShared: true,
    packages: withS3 ? ['@aws-sdk/client-s3'] : [],
  },
  { name: 'agent', entry: 'agent/index.js', needsShared: true, packages: ['@aws-sdk/client-bedrock-runtime'] },
  { name: 'lead', entry: 'lead/index.js', needsShared: true, packages: ['@aws-sdk/client-secrets-manager'] },
  { name: 'batch', entry: 'batch/index.js', needsShared: true, packages: ['@aws-sdk/client-s3'] },
]

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)])

function readManifest(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
}

/** Collects the transitive dependency closure of a set of root packages. */
function resolveClosure(roots) {
  const found = new Set()
  const queue = [...roots]

  while (queue.length > 0) {
    const name = queue.pop()
    if (found.has(name)) continue

    const dir = join(rootModules, name)
    if (!existsSync(dir)) {
      throw new Error(`Cannot resolve "${name}" in ${rootModules}. Run npm --prefix backend install.`)
    }

    found.add(name)

    const manifest = readManifest(dir)
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      // Optional/peer deps are not required at runtime for these SDK clients.
      if (!found.has(dependency)) queue.push(dependency)
    }
  }

  return [...found].sort()
}

/** Lists the .js files sitting next to an entry point, e.g. tool-validation.js. */
function siblingModules(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((file) => file.endsWith('.js') && file !== 'index.js')
}

/** Verifies every relative require resolves inside the bundle. */
function checkRelativeRequires(entryFile, bundleDir) {
  const source = readFileSync(join(bundleDir, entryFile), 'utf8')
  const pattern = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g
  const missing = []

  for (const [, specifier] of source.matchAll(pattern)) {
    const target = resolve(dirname(join(bundleDir, entryFile)), specifier)
    if (!existsSync(target)) missing.push(specifier)
  }

  return missing
}

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })

// Shared engine code is copied once and reused as the source for every bundle.
const sharedSrc = join(backendDir, 'shared')

const results = []

for (const fn of FUNCTIONS) {
  const bundleDir = join(outDir, fn.name)
  mkdirSync(bundleDir, { recursive: true })

  // Entry point and the folder it lives in (tool-validation.js, validation.js).
  cpSync(join(backendDir, fn.entry), join(bundleDir, fn.entry))
  const entryDir = dirname(fn.entry)
  for (const file of siblingModules(join(backendDir, entryDir))) {
    cpSync(join(backendDir, entryDir, file), join(bundleDir, entryDir, file))
  }

  if (fn.needsShared) cpSync(sharedSrc, join(bundleDir, 'shared'), { recursive: true })

  const closure = resolveClosure(fn.packages)
  if (closure.length > 0) {
    mkdirSync(join(bundleDir, 'node_modules'), { recursive: true })
    for (const pkg of closure) {
      cpSync(join(rootModules, pkg), join(bundleDir, 'node_modules', pkg), { recursive: true })
    }
  }

  // A package.json at the bundle root would change how Lambda loads the handler.
  writeFileSync(
    join(bundleDir, 'package.json'),
    `${JSON.stringify({ name: `atelier-predict-${fn.name}`, private: true, type: 'commonjs' }, null, 2)}\n`,
    'utf8',
  )

  const missing = checkRelativeRequires(fn.entry, bundleDir)
  if (missing.length > 0) {
    throw new Error(`[${fn.name}] unresolved relative imports: ${missing.join(', ')}`)
  }

  results.push({ ...fn, packages: closure })
}

for (const result of results) {
  console.log(`  ${result.name.padEnd(10)} entry=${result.entry.padEnd(22)} packages=${result.packages.length}`)
}

writeFileSync(
  join(outDir, 'bundles.json'),
  `${JSON.stringify(
    results.map((r) => ({ name: r.name, entry: r.entry, packages: r.packages })),
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(`\nStaged ${results.length} bundles in ${outDir}`)
