/**
 * Generates robots.txt and sitemap.xml at build time.
 *
 * The route list is not written here: `routes.mjs` parses it out of the same
 * TypeScript the router reads, so the sitemap cannot advertise a route that the
 * build does not emit a file for.
 *
 * Single source of truth for the origin: set SITE_URL when a custom domain is
 * attached to Amplify and both files follow. Runs from `prebuild` so the
 * generated files can never drift from the deploy.
 *
 * Usage: node scripts/generate-seo.mjs [siteUrl]
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROUTES, SITE_URL } from './routes.mjs'

const site = (process.argv[2] ?? SITE_URL).replace(/\/$/, '')
const outDir = process.argv[3] ?? join(process.cwd(), 'dist')

const urlEntries = ROUTES.map((route) => {
  const alternates = route.alternates
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

console.log(`generated sitemap.xml (${ROUTES.length} urls) and robots.txt for ${site}`)
