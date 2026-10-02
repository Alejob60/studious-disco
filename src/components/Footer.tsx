import { BrainCircuit } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider'
import { LEGAL_LABELS, slugFromDocId, type LegalDocId } from '../content/legal-meta'

const LEGAL_LINKS: LegalDocId[] = ['privacy', 'terms', 'cookies', 'refunds']

/** Closing bar with the legal index and the hackathon attribution. */
export function Footer() {
  const { t, locale } = useI18n()
  const year = new Date().getFullYear()

  return (
    <footer className="relative z-10 mt-8 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label={t('footer.legal')} className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
            {t('footer.legal')}
          </span>
          {LEGAL_LINKS.map((id) => (
            <Link
              key={id}
              to={`/${locale}/${slugFromDocId(id, locale)}`}
              className="text-xs text-body transition-colors hover:text-gold"
            >
              {LEGAL_LABELS[locale][id]}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col items-start justify-between gap-3 border-t border-line pt-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-body">
            <BrainCircuit className="size-4 text-gold" strokeWidth={1.75} />
            <span>
              Atelier <span className="text-gold">Predict</span>
            </span>
          </div>

          <p className="text-center text-xs text-white/35 sm:text-right">
            {t('footer.built')}
            <br className="hidden sm:block" /> © {year} {t('footer.rights')}
          </p>
        </div>
      </div>
    </footer>
  )
}
