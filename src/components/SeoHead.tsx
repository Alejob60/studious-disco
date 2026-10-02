import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { analyticsEnabled, trackPageView } from '../lib/analytics'
import { slugFromDocId, type LegalDocId } from '../content/legal-meta'
import { LEGAL_TITLES } from '../content/legal-titles'

/**
 * Keeps the document head honest for a client-rendered app.
 *
 * A single-page app cannot vary its title or canonical URL per route with static
 * markup, so without this every route would share the index.html title and
 * crawlers would treat /en/terms as a duplicate of /es/terminos.
 */
export function SeoHead({ origin }: { origin: string }) {
  const { locale, t } = useI18n()
  const location = useLocation()
  const [, slug] = location.pathname.split('/').filter(Boolean)
  const pathname = location.pathname === '/' ? `/${locale}` : location.pathname

  useEffect(() => {
    const translated = locale === 'en' ? 'en' : 'es'
    const otherLocale = translated === 'es' ? 'en' : 'es'

    const isLegal = (Object.keys(LEGAL_TITLES) as string[]).includes(slug ?? '')
    const title = isLegal
      ? `${LEGAL_TITLES[slug as LegalDocId][locale]} · Atelier Predict`
      : t('meta.title')
    const description = t('meta.description')

    document.title = title

    setMeta('description', description)
    setMeta('og:title', title)
    setMeta('og:description', description)
    setMeta('og:url', `${origin}${pathname}`)
    setMeta('og:type', 'website')
    setMeta('og:site_name', 'Atelier Predict')
    setLink('canonical', `${origin}${pathname}`)

    // hreflang pairs so Google treats the two languages as translations of one page.
    const alternatePath = isLegal ? alternateLegalPath(slug as LegalDocId, otherLocale) : `/${otherLocale}`
    setLink('alternate-es', `${origin}${alternatePath}`, 'hreflang', 'es')
    setLink('alternate-en', `${origin}${alternatePath}`, 'hreflang', 'en')
    setLink('alternate-x-default', `${origin}/es`, 'hreflang', 'x-default')

    injectJsonLd(isLegal ? legalJsonLd(slug as LegalDocId, locale, `${origin}${pathname}`) : productJsonLd(origin, description))
    setMeta('twitter:card', 'summary_large_image')
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)

    trackPageView(pathname, title, locale)
  }, [locale, t, slug, pathname, origin])

  if (!analyticsEnabled) return null
  return null
}

function setMeta(name: string, content: string) {
  const element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"], meta[property="og:${name}"]`)
  if (element) element.content = content
}

function setLink(id: string, href: string, rel = 'canonical', hreflang?: string) {
  const selector = hreflang ? `link[rel="${rel}"][hreflang="${hreflang}"]` : `link[rel="${rel}"]`
  const element = document.head.querySelector<HTMLLinkElement>(selector)
  if (element) element.href = href
  else {
    const created = document.createElement('link')
    created.rel = rel
    if (hreflang) created.setAttribute('hreflang', hreflang)
    created.id = id
    created.href = href
    document.head.appendChild(created)
  }
}

function injectJsonLd(payload: unknown) {
  const id = 'jsonld-page'
  let script = document.getElementById(id) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(payload)
}

/** Maps a legal slug to the same document in the other language. */
function alternateLegalPath(id: LegalDocId, locale: 'es' | 'en') {
  return `/${locale}/${slugFromDocId(id, locale)}`
}

function productJsonLd(origin: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Atelier Predict',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: origin,
    description,
    inLanguage: ['es', 'en'],
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'COP', availability: 'https://schema.org/PreOrder' },
    provider: {
      '@type': 'Organization',
      name: 'ColombiaTIC Ingeniería SAS',
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'enterprise@colombiatic.com.co',
        contactType: 'sales',
        availableLanguage: ['es', 'en'],
      },
    },
  }
}

function legalJsonLd(id: LegalDocId, locale: 'es' | 'en', url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: LEGAL_TITLES[id][locale],
    url,
    inLanguage: locale,
    isPartOf: { '@type': 'WebSite', name: 'Atelier Predict' },
  }
}


