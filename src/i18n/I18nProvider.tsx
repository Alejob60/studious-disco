import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { dictionaries, DEFAULT_LOCALE, LOCALES, type Dictionary, type Locale } from './dictionaries'

type Interpolations = Record<string, string | number>

type I18nValue = {
  locale: Locale
  t: (key: string, vars?: Interpolations | string) => string
  /** Picks the first of `keys` that exists, for copy shared across locales. */
  pick: (...keys: string[]) => string
  /** Direct dictionary access, for content that is not a flat string (arrays). */
  dict: Dictionary
  locales: typeof LOCALES
}

const I18nContext = createContext<I18nValue | null>(null)

function resolve(dictionary: Dictionary | undefined, key: string): string | undefined {
  if (!dictionary) return undefined

  let node: unknown = dictionary
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined
    node = (node as Record<string, unknown>)[part]
  }

  return typeof node === 'string' ? node : undefined
}

/**
 * Minimal i18n provider.
 *
 * Intentionally tiny: the app only needs a locale, dotted-key lookup and `{token}`
 * interpolation, so a library would add weight without buying anything. The key
 * contract matches colombiatic.com.co (`t('a.b', { year: 2026 })`) so translators
 * see the same convention in both projects.
 */
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const active: Locale = locale in dictionaries ? locale : DEFAULT_LOCALE
  const dictionary = dictionaries[active]

  const t = useCallback(
    (key: string, vars?: Interpolations | string) => {
      const translated = resolve(dictionary, key) ?? resolve(dictionaries.es, key)

      // A missing key must be visible during development but must not break the
      // page in production, so fall back to the key itself.
      if (translated === undefined) return key

      if (vars === undefined) return translated
      if (typeof vars === 'string') return vars

      return translated.replace(/\{(\w+)\}/g, (match, token: string) =>
        vars[token] === undefined ? match : String(vars[token]),
      )
    },
    [dictionary],
  )

  const pick = useCallback(
    (...keys: string[]) => {
      for (const key of keys) {
        const value = resolve(dictionary, key) ?? resolve(dictionaries.es, key)
        if (value !== undefined) return value
      }
      return keys[0] ?? ''
    },
    [dictionary],
  )

  const value = useMemo<I18nValue>(
    () => ({ locale: active, t, pick, dict: dictionary, locales: LOCALES }),
    [active, t, pick, dictionary],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used inside <I18nProvider>')
  return context
}

export function isLocale(value: string | undefined): value is Locale {
  return value === 'es' || value === 'en'
}