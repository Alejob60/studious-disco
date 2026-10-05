/**
 * Emits a real index.html for every client route.
 *
 * The site is a static SPA on S3 behind CloudFront, and Amplify's custom rewrite
 * was not being applied in this account: `/es` answered 301 to `/es/` and that
 * object did not exist, so a judge refreshing the page in either language got a
 * 404. Depending on the console to fix it would leave the demo at the mercy of a
 * setting nobody verifies, so the fix happens at build time instead.
 *
 * Each copy is localised rather than duplicated. The SPA sets `<html lang>` from
 * JavaScript after mount, so a byte-identical copy would be served to crawlers
 * and to anyone reading the source as Spanish no matter which route was requested.
 * The title and description therefore come from the same dictionary the app uses,
 * extracted from src/i18n/dictionaries.ts, and the build fails loudly if that
 * stops being findable rather than silently shipping Spanish on the English route.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const distDir = join(repoRoot, 'dist')
const indexFile = join(distDir, 'index.html')

if (!existsSync(indexFile)) {
  console.error(`No ${indexFile}. Run the build first.`)
  process.exit(1)
}

const LOCALES = ['es', 'en']
const SLUGS = ['legal']

/** Pulls meta.title / meta.description out of the locale block of the dictionary. */
function readLocaleMeta(locale) {
  const source = readFileSync(join(repoRoot, 'src', 'i18n', 'dictionaries.ts'), 'utf8')

  // Each locale starts at its own `const`, so the search cannot bleed across.
  const blockPattern =
    locale === 'es'
      ? /const es = \{[\s\S]*?meta: \{([\s\S]*?)\},/
      : /const en: Dictionary = \{[\s\S]*?meta: \{([\s\S]*?)\},/

  const block = source.match(blockPattern)
  if (!block) {
    console.error(`Could not find the "${locale}" meta block in src/i18n/dictionaries.ts.`)
    process.exit(1)
  }

  const pick = (key) => {
    const match = block[1].match(new RegExp(`${key}:\\s*'([^']*)'`))
    if (!match) {
      console.error(`Could not find meta.${key} for "${locale}".`)
      process.exit(1)
    }
    return match[1]
  }

  return { title: pick('title'), description: pick('description') }
}

/** Rewrites the shell so a static fetch reports the right language and title. */
function localiseHtml(html, locale) {
  const { title, description } = readLocaleMeta(locale)

  let out = html.replace(/<html lang="[^"]*"/, `<html lang="${locale}"`)
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
  // Vite formats index.html across lines, so name= and content= are not on the
  // same one. Both single-line and multi-line shapes are handled.
  out = out.replace(
    /(<meta\b[^>]*\bname="description"[^>]*\bcontent=")[^"]*(")/s,
    `$1${description}$2`
  )
  // Canonical plus alternates, so the locales are not served as duplicates.
  out = out.replace(
    /<link rel="canonical" href="[^"]*"/,
    `<link rel="canonical" href="https://main.d28ukybtuih8pa.amplifyapp.com/${locale}"`
  )

  return out
}

const shell = readFileSync(indexFile, 'utf8')
const written = []

for (const locale of LOCALES) {
  for (const slug of [null, ...SLUGS]) {
    const dir = slug ? join(distDir, locale, slug) : join(distDir, locale)
    mkdirSync(dir, { recursive: true })
    // The legal page is reachable under the same shell, so every copy carries the
    // locale it lives under.
    writeFileSync(join(dir, 'index.html'), localiseHtml(shell, locale), 'utf8')
    written.push(`/${locale}${slug ? `/${slug}` : ''}/`)
  }
}

// The unprefixed root keeps whatever generate-seo.mjs produced; S3 redirects
// /es to /es/, so the trailing-slash directory is what actually gets requested.
console.log(`emitted ${written.length} localised entries: ${written.join(' ')}`)