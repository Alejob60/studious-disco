/**
 * The canonical route manifest, derived from the sources the app itself uses.
 *
 * Two consumers need the same list and must never disagree:
 *
 *   - `generate-seo.mjs`      writes sitemap.xml
 *   - `emit-locale-entries.mjs` writes a real index.html per route
 *
 * Both used to carry their own hardcoded copy, which is how eight of the eleven
 * sitemap URLs ended up 404ing: the sitemap advertised routes that nothing emitted.
 * One list, parsed from the TypeScript the router reads, removes the possibility.
 *
 * The sources are parsed rather than imported because these scripts run before
 * `tsc`. Every lookup fails the build loudly instead of silently shipping a
 * default, which is the whole point: a rename in legal-meta.ts must break the
 * build, not quietly unlist a policy page.
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')

const read = (...segments) => readFileSync(join(repoRoot, ...segments), 'utf8')

function fail(message) {
  console.error(`routes.mjs: ${message}`)
  process.exit(1)
}

/** Pulls the body of a `export const NAME ... = { ... }` block. */
function objectBody(source, name) {
  const match = source.match(new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\}`))
  if (!match) fail(`could not find "${name}".`)
  return match[1]
}

/** Pulls the entries of a `export const NAME ... = [ ... ]` list. */
function listBody(source, name) {
  const match = source.match(new RegExp(`export const ${name}[^=]*= \\[([^\\]]*)\\]`))
  if (!match) fail(`could not find "${name}".`)
  return match[1]
}

/** Reads `key: 'value'` pairs out of a TypeScript object body. */
function stringMap(body, what) {
  const entries = [...body.matchAll(/(\w+):\s*'([^']*)'/g)]
  if (entries.length === 0) fail(`no entries parsed out of ${what}.`)
  return Object.fromEntries(entries.map(([, key, value]) => [key, value]))
}

const dictionaries = read('src', 'i18n', 'dictionaries.ts')
const legalMeta = read('src', 'content', 'legal-meta.ts')
const legalTitles = read('src', 'content', 'legal-titles.ts')

/** meta.title / meta.description for one locale, the same pair the runtime uses. */
function readLocaleMeta(locale) {
  // Each locale starts at its own `const`, so the search cannot bleed across.
  const blockPattern =
    locale === 'es'
      ? /const es = \{[\s\S]*?meta: \{([\s\S]*?)\},/
      : /const en: Dictionary = \{[\s\S]*?meta: \{([\s\S]*?)\},/

  const block = dictionaries.match(blockPattern)
  if (!block) fail(`could not find the "${locale}" meta block in src/i18n/dictionaries.ts.`)

  const pick = (key) => {
    const match = block[1].match(new RegExp(`${key}:\\s*'([^']*)'`))
    if (!match) fail(`could not find meta.${key} for "${locale}".`)
    return match[1]
  }

  return { title: pick('title'), description: pick('description') }
}

const SLUG_ES = stringMap(objectBody(legalMeta, 'LEGAL_SLUG'), 'LEGAL_SLUG')
const SLUG_EN = stringMap(objectBody(legalMeta, 'LEGAL_SLUG_EN'), 'LEGAL_SLUG_EN')
const ORDER = listBody(legalMeta, 'LEGAL_ORDER')
  .split(',')
  .map((entry) => entry.trim().replace(/^'|'$/g, ''))
  .filter(Boolean)

if (ORDER.length === 0) fail('LEGAL_ORDER parsed empty.')

const LOCALES = ['es', 'en']
const slugFor = (docId, locale) => {
  const map = locale === 'en' ? SLUG_EN : SLUG_ES
  const slug = map[docId]
  if (!slug) fail(`no ${locale} slug for legal document "${docId}".`)
  return slug
}

/** Titles are nested one level deeper (`privacy: { es: '…', en: '…' }`). */
function titleFor(docId, locale) {
  const block = legalTitles.match(new RegExp(`${docId}:\\s*\\{([^}]*)\\}`))
  if (!block) fail(`no title block for legal document "${docId}".`)
  const title = block[1].match(new RegExp(`${locale}:\\s*'([^']*)'`))
  if (!title) fail(`no ${locale} title for legal document "${docId}".`)
  return title[1]
}

for (const docId of ORDER) {
  if (!SLUG_ES[docId] || !SLUG_EN[docId]) fail(`legal document "${docId}" is missing a slug in one locale.`)
  titleFor(docId, 'es')
  titleFor(docId, 'en')
}

export const SITE_URL = (
  process.env.SITE_URL ?? 'https://main.d28ukybtuih8pa.amplifyapp.com'
).replace(/\/$/, '')

/**
 * Every route the sitemap advertises, in the order it advertises them.
 *
 * `dir` is the directory to create inside dist; `''` means the root entry, which
 * Vite already wrote and which is deliberately left untouched.
 */
export const ROUTES = [
  {
    path: '/',
    dir: '',
    locale: 'es',
    kind: 'root',
    alternates: ['/es', '/en'],
    priority: '1.0',
    changefreq: 'weekly',
  },
  ...LOCALES.map((locale) => ({
    path: `/${locale}`,
    dir: locale,
    locale,
    kind: 'locale',
    alternates: [`/${locale === 'es' ? 'en' : 'es'}`],
    priority: '1.0',
    changefreq: 'weekly',
  })),
  ...LOCALES.flatMap((locale) =>
    ORDER.map((docId) => {
      const slug = slugFor(docId, locale)
      const otherLocale = locale === 'es' ? 'en' : 'es'
      return {
        path: `/${locale}/${slug}`,
        dir: `${locale}/${slug}`,
        locale,
        kind: 'legal',
        docId,
        // Mirrors SeoHead.tsx exactly, so the static copy and the hydrated
        // document agree and the page does not change title under the crawler.
        title: `${titleFor(docId, locale)} · Atelier Predict`,
        description: readLocaleMeta(locale).description,
        alternates: [`/${otherLocale}/${slugFor(docId, otherLocale)}`],
        priority: '0.3',
        changefreq: 'yearly',
      }
    }),
  ),
]

/** Same list, but without the root entry: only these need an emitted file. */
export const EMITTABLE_ROUTES = ROUTES.filter((route) => route.dir !== '')

export const localeMeta = readLocaleMeta
