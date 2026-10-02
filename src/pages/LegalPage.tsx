import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Mail, ShieldCheck } from 'lucide-react'
import { useI18n } from '../i18n/I18nProvider'
import { LEGAL_DOCS } from '../content/legal'
import { docIdFromSlug, LEGAL_LABELS, LEGAL_ORDER, slugFromDocId } from '../content/legal-meta'

/**
 * Renders one legal document.
 *
 * The copy lives in `src/content/legal.ts` so both locales stay side by side and
 * the page renderer stays presentational.
 */
export function LegalPage() {
  const { locale, t } = useI18n()
  const { slug } = useParams<{ slug: string }>()

  const docId = docIdFromSlug(slug, locale)
  const doc = docId ? LEGAL_DOCS[locale][docId] : null

  if (!doc || !docId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-white">{t('common.notFound')}</h1>
        <Link to={`/${locale}`} className="mt-6 inline-block text-sm text-gold underline underline-offset-2">
          {t('common.goHome')}
        </Link>
      </div>
    )
  }

  const siblings = LEGAL_ORDER.filter((id) => id !== docId)

  return (
    <div className="relative z-10 mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
      <Link
        to={`/${locale}`}
        className="inline-flex items-center gap-2 text-sm text-body transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" strokeWidth={2} />
        {t('legal.backToHome')}
      </Link>

      <header className="mt-8 border-b border-line pb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{doc.title}</h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/40">
          <span>
            {t('legal.updated')}: {doc.updated}
          </span>
          <span>
            {t('legal.effective')}: {doc.effective}
          </span>
        </p>
      </header>

      {/* This MVP copy is a reference draft. Saying so on the page keeps it from
          being mistaken for reviewed legal text. */}
      <p className="mt-6 flex items-start gap-2.5 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-xs leading-relaxed text-gold">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} />
        {t('legal.draftNotice')}
      </p>

      <nav className="mt-8 rounded-xl border border-line bg-surface p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">{t('legal.toc')}</p>
        <ul className="mt-3 space-y-1.5">
          {doc.sections.map((section, index) => (
            <li key={section.heading}>
              <a
                href={`#seccion-${index}`}
                className="block truncate text-sm text-body transition-colors hover:text-gold"
              >
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-10 space-y-9">
        {doc.intro.map((paragraph, index) => (
          <p key={index} className="text-[15px] leading-relaxed text-body">
            {paragraph}
          </p>
        ))}

        {doc.sections.map((section, index) => (
          <section key={section.heading} id={`seccion-${index}`} className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-white sm:text-xl">{section.heading}</h2>
            {section.paragraphs.map((paragraph, pIndex) => (
              <p key={pIndex} className="mt-3 text-[15px] leading-relaxed text-body">
                {paragraph}
              </p>
            ))}
            {section.list && (
              <ul className="mt-4 space-y-2">
                {section.list.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-3 text-[15px] leading-relaxed text-body">
                    <span className="mt-2 size-1 shrink-0 rounded-full bg-gold" />
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <div className="mt-14 rounded-xl border border-line bg-surface p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-white">
          <Mail className="size-4 text-gold" strokeWidth={2} />
          {t('legal.contactHeading')}
        </p>
        <a
          href="mailto:enterprise@colombiatic.com.co"
          className="mt-2 inline-block text-sm text-gold underline underline-offset-2 hover:text-gold-light"
        >
          enterprise@colombiatic.com.co
        </a>
      </div>

      <nav className="mt-8 border-t border-line pt-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-body">{t('footer.legal')}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {siblings.map((id) => (
            <li key={id}>
              <Link
                to={`/${locale}/${slugFromDocId(id, locale)}`}
                className="inline-block rounded-lg border border-line px-3 py-2 text-xs text-body transition-colors hover:border-gold/40 hover:text-gold"
              >
                {LEGAL_LABELS[locale][id]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
