/**
 * Emits a real index.html for every client route.
 *
 * The site is a static SPA on S3 behind CloudFront, and Amplify's custom rewrite
 * was not being applied in this account: `/es` answered 301 to `/es/` and that
 * object did not exist, so a judge refreshing the page in either language got a
 * 404. Depending on the console to fix it would leave the demo at the mercy of a
 * setting nobody verifies, so the fix happens at build time instead.
 *
 * Writing an actual object per route makes the redirect land on something real.
 * Absolute asset paths (`/assets/...`) mean the copies work unchanged from any
 * depth. Anything not listed here still resolves to the SPA, whose own NotFound
 * route redirects to the locale root.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(here, '..', 'dist')
const indexFile = join(distDir, 'index.html')

if (!existsSync(indexFile)) {
  console.error(`No ${indexFile}. Run the build first.`)
  process.exit(1)
}

const LOCALES = ['es', 'en']
const SLUGS = ['legal']

const written = []
for (const locale of LOCALES) {
  for (const slug of [null, ...SLUGS]) {
    const dir = slug ? join(distDir, locale, slug) : join(distDir, locale)
    mkdirSync(dir, { recursive: true })
    copyFileSync(indexFile, join(dir, 'index.html'))
    written.push(`/${locale}${slug ? `/${slug}` : ''}/`)
  }
}

// The unprefixed root already has index.html at the top level; S3 redirects /es
// to /es/, so the trailing-slash directory is what actually gets requested.
console.log(`emitted ${written.length} locale entries: ${written.join(' ')}`)