/**
 * Generates robots.txt and sitemap.xml at build time.
 *
 * Single source of truth for the origin: set SITE_URL when a custom domain is
 * attached to Amplify and both files follow. Runs from `prebuild` so the
 * generated files can never drift from the deploy.
 *
 * Usage: node scripts/generate-seo.mjs [siteUrl]
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const site = (process.argv[2] ?? process.env.SITE_URL ?? 'https://main.d28ukybtuih8pa.amplifyapp.com').replace(/\/$/, '')
const outDir = process.argv[3] ?? join(process.cwd(), 'dist')

// The app uses locale-prefixed client routes, so every entry has two alternates.
const routes = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/es', priority: '1.0', changefreq: 'weekly' },
  { path: '/en', priority: '1.0', changefreq: 'weekly' },
  { path: '/es/privacidad', priority: '0.3', changefreq: 'yearly' },
  { path: '/es/terminos', priority: '0.3', changefreq: 'yearly' },
  { path: '/es/cookies', priority: '0.3', changefreq: 'yearly' },
  { path: '/es/reembolsos', priority: '0.3', changefreq: 'yearly' },
  { path: '/en/privacy', priority: '0.3', changefreq: 'yearly' },
  { path: '/en/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/en/cookies', priority: '0.3', changefreq: 'yearly' },
  { path: '/en/refunds', priority: '0.3', changefreq: 'yearly' },
]

const alternatesFor = (route) => {
  if (route.path === '/') return ['/es', '/en']
  const [locale] = route.path.split('/')
  const other = locale === 'es' ? 'en' : 'es'
  const translated = { privacidad: 'privacy', terminos: 'terms', cookies: 'cookies', reembolsos: 'refunds' }
  const [, slug] = route.path.split('/')
  return [`/${other}/${translated[slug] ?? slug}`]
}

const urlEntries = routes
  .map((route) => {
    const alternates = alternatesFor(route)
      .map((path) => `    <xhtml:link rel="alternate" hreflang="${path.startsWith('/es') ? 'es' : 'en'}" href="${site}${path}" />`)
      .join('\n')

    return [
      '  <url>',
      `    <loc>${site}${route.path}</loc>`,
      `    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      alternates,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n')
  })
  .join('\n')

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>
`

const robots = `# Atelier Predict — hackathon build
User-agent: *
Allow: /

# The API is a separate host; nothing here is private except the lead endpoint.
Disallow: /lead
`

// dist does not exist yet on a clean build.
mkdirSync(outDir, { recursive: true })

writeFileSync(join(outDir, 'sitemap.xml'), sitemap, 'utf8')
writeFileSync(join(outDir, 'robots.txt'), robots, 'utf8')

console.log(`generated sitemap.xml (${routes.length} urls) and robots.txt for ${site}`)
