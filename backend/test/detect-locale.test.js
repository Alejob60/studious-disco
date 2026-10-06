const test = require('node:test')
const assert = require('node:assert/strict')
const { detectLocale } = require('../../src/i18n/detectLocale.ts')

/**
 * The root URL used to be hardcoded to Spanish. These cases pin the behaviour
 * that replaced it, because the failure is silent: the page still renders, it
 * just renders in the wrong language for the person reading it.
 */

test('an English-speaking browser gets English', () => {
  assert.equal(detectLocale(['en-US', 'en']), 'en')
  assert.equal(detectLocale(['en-GB', 'en-GB', 'en']), 'en')
  assert.equal(detectLocale(['en']), 'en')
})

test('a Spanish-speaking browser gets Spanish', () => {
  assert.equal(detectLocale(['es-CO', 'es']), 'es')
  assert.equal(detectLocale(['es-MX', 'es', 'en-US']), 'es')
  assert.equal(detectLocale(['es']), 'es')
})

test('preference order decides, not the mere presence of a tag', () => {
  // A US browser with Spanish configured as a secondary language. Scanning for
  // "any Spanish tag" would hand this visitor the Spanish interface.
  assert.equal(detectLocale(['en-US', 'en', 'es']), 'en')
})

test('a language we do not serve falls through to the next preference', () => {
  assert.equal(detectLocale(['fr-FR', 'fr', 'en-GB', 'en']), 'en')
  assert.equal(detectLocale(['de-DE', 'de']), 'en')
})

test('an unknown or absent preference falls back to English, not Spanish', () => {
  // English is the safer floor: the copy is complete, and the audience outside
  // Colombia can read it.
  assert.equal(detectLocale([]), 'en')
  assert.equal(detectLocale(['ja-JP']), 'en')
})

test('region subtags are matched case-insensitively', () => {
  assert.equal(detectLocale(['EN-gb']), 'en')
  assert.equal(detectLocale(['ES-CO']), 'es')
})

test('a POSIX-style tag with an underscore still resolves', () => {
  // Not what the spec returns, but some WebViews and Android builds report it,
  // and splitting only on the hyphen reads `en_US` as an unknown language.
  assert.equal(detectLocale(['en_US']), 'en')
  assert.equal(detectLocale(['es_CO']), 'es')
})

test('a malformed tag does not throw and does not stop the scan', () => {
  assert.equal(detectLocale(['', '-', 'x-private']), 'en')
  assert.equal(detectLocale(['', '-', 'x-private', 'en-GB']), 'en')
})
