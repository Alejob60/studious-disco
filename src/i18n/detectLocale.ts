import type { Locale } from './dictionaries'

/**
 * Chooses the interface language for someone who arrived at the unprefixed root.
 *
 * The root used to be hardcoded to Spanish, which meant the demo opened in
 * Spanish for everyone. The audience is not only Colombia: the judges, and most
 * of the cloud this runs on, read English, and a judge who opens the link and
 * gets a page they cannot read is a judge who never sees the agent.
 *
 * An explicit `/es` or `/en` in the URL always wins, because that is what the
 * language switcher produces and what a shared link carries. Detection only
 * decides the language of a bare `/`.
 *
 * Order matters and is respected. Browsers list `navigator.languages` in
 * descending preference, so `['en-US', 'en', 'es']` — a US browser with Spanish
 * as a secondary language — must resolve to English, while `['es-CO', 'es',
 * 'en']` resolves to Spanish. Scanning for "any Spanish tag" would get the first
 * case backwards.
 */

/**
 * Used when the browser asks for neither language.
 *
 * English, not the app's `DEFAULT_LOCALE`. A visitor whose browser declares only
 * German or Japanese has not expressed a preference for Spanish, and the demo is
 * read mostly outside Colombia. Exported because the build bakes the same choice
 * into the static shell for the root URL.
 */
export const FALLBACK_LOCALE: Locale = 'en'

export function detectLocale(languages?: readonly string[]): Locale {
  const tags =
    languages ??
    (typeof navigator === 'undefined'
      ? []
      : // `languages` is the ordered preference list; `language` is its first
        // entry, and is all that older browsers expose.
        (navigator.languages?.length ? navigator.languages : [navigator.language ?? '']))

  for (const tag of tags) {
    // Compare the primary subtag so `en-GB`, `en-US` and `en` all match, and so a
    // region never has to be enumerated. The underscore is not in the spec for
    // this list, but some WebViews and Android builds report `en_US`, and
    // splitting only on the hyphen would read that as an unknown language.
    const primary = tag.toLowerCase().split(/[-_]/)[0]
    if (primary === 'es' || primary === 'en') return primary
  }

  return FALLBACK_LOCALE
}
