const test = require('node:test')
const assert = require('node:assert/strict')
const {
  ALLOWED_INTERESTS,
  buildNotes,
  clean,
  escapeHtml,
  parseLead,
} = require('../lead/validation.js')

const VALID = {
  name: 'Ana Torres',
  email: 'Ana.Torres@ColombiaTIC.com.co',
  company: 'ColombiaTIC',
  role: 'Directora de datos',
  challenge: 'Necesito pronóstico por tienda y SKU.',
  interests: ['business'],
  locale: 'es',
  website: '',
}

test('clean trims and caps length', () => {
  assert.equal(clean('  hola  ', 100), 'hola')
  assert.equal(clean('abcdef', 3), 'abc')
  assert.equal(clean(undefined, 10), '')
  assert.equal(clean(42, 10), '', 'non-strings become empty, never "42"')
})

test('escapeHtml neutralises markup injection', () => {
  const attack = `<script>alert('xss')</script>`
  const escaped = escapeHtml(attack)
  assert.ok(!escaped.includes('<script>'))
  assert.ok(escaped.includes('&lt;script&gt;'))

  assert.equal(escapeHtml('a & b'), 'a &amp; b')
  assert.equal(escapeHtml(`"double" and 'single'`), '&quot;double&quot; and &#39;single&#39;')
})

test('a valid lead parses and normalises', () => {
  const result = parseLead(VALID)
  assert.equal(result.ok, true)
  assert.deepEqual(result.errors, [])
  assert.equal(result.isHoneypot, false)
  // Emails are lowercased so CRM lookups are case-insensitive.
  assert.equal(result.lead.email, 'ana.torres@colombiatic.com.co')
})

test('every required field is reported when missing', () => {
  const result = parseLead({})
  assert.equal(result.ok, false)
  for (const field of ['name', 'email', 'company', 'role', 'challenge']) {
    assert.ok(result.errors.includes(field), `expected ${field} to be flagged`)
  }
})

test('malformed emails are rejected', () => {
  for (const email of ['not-an-email', 'a@b', 'a b@c.com', '@colombiatic.com', '']) {
    const result = parseLead({ ...VALID, email })
    assert.equal(result.ok, false, `expected ${JSON.stringify(email)} to fail`)
    assert.ok(result.errors.includes('email'))
  }
})

test('an over-long email is rejected', () => {
  const long = `${'a'.repeat(250)}@colombiatic.com.co`
  assert.equal(parseLead({ ...VALID, email: long }).ok, false)
})

test('interests are allow-listed and capped', () => {
  const unknown = parseLead({ ...VALID, interests: ['business', '<script>', 42, 'investment'] })
  assert.deepEqual(unknown.lead.interests, ['business', 'investment'])

  const tooMany = parseLead({ ...VALID, interests: [...ALLOWED_INTERESTS, 'business', 'investment'] })
  assert.equal(tooMany.lead.interests.length, 5)

  const notArray = parseLead({ ...VALID, interests: 'business' })
  assert.deepEqual(notArray.lead.interests, [])
})

test('locale defaults to es and only accepts en', () => {
  assert.equal(parseLead({ ...VALID, locale: 'en' }).lead.locale, 'en')
  assert.equal(parseLead({ ...VALID, locale: 'pt' }).lead.locale, 'es')
  assert.equal(parseLead({ ...VALID, locale: undefined }).lead.locale, 'es')
})

test('a filled honeypot is flagged without failing validation', () => {
  const result = parseLead({ ...VALID, website: 'https://spam.example' })
  assert.equal(result.isHoneypot, true)
  // Fields are still valid: the caller answers 201 and sends no mail.
  assert.equal(result.ok, true)
})

test('a null body does not throw', () => {
  const result = parseLead(null)
  assert.equal(result.ok, false)
  assert.equal(result.lead.locale, 'es')
})

test('field lengths are capped rather than rejected', () => {
  const result = parseLead({ ...VALID, challenge: 'x'.repeat(9000) })
  assert.equal(result.ok, true)
  assert.equal(result.lead.challenge.length, 4000)
})

test('buildNotes carries the source tag for attribution', () => {
  const { lead } = parseLead(VALID)
  const notes = buildNotes(lead, { business: 'Empresas y comercio' }, 'atelier-predict-hackathon')

  assert.ok(notes.includes('Cargo: Directora de datos'))
  assert.ok(notes.includes('Empresas y comercio'))
  assert.ok(notes.includes('Desafío:'))
  assert.ok(notes.includes('Origen: atelier-predict-hackathon'))
  assert.ok(notes.includes('Locale: es'))
})