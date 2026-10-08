const test = require('node:test')
const assert = require('node:assert/strict')
const { CHANNELS, clampInt, validateToolInput } = require('../agent/tool-validation.js')

test('clampInt coerces, rounds and bounds values', () => {
  const bounds = { min: 1, max: 100 }
  assert.equal(clampInt('42', bounds), 42)
  assert.equal(clampInt(42.6, bounds), 43)
  assert.equal(clampInt(-10, bounds), 1)
  assert.equal(clampInt(1e9, bounds), 100)
  // Unparseable input falls back to the minimum, never NaN.
  assert.equal(clampInt('abc', bounds), 1)
  assert.equal(clampInt(undefined, bounds), 1)
})

test('an unknown tool yields an empty object', () => {
  assert.deepEqual(validateToolInput('rm_rf', { path: '/' }), {})
  assert.deepEqual(validateToolInput('unknown', undefined), {})
})

test('activate_campaign keeps only allowed channels', () => {
  for (const channel of CHANNELS) {
    assert.equal(validateToolInput('activate_campaign', { channel }).channel, channel)
  }
  // A model hallucinating a channel must not reach the UI verbatim.
  assert.equal(validateToolInput('activate_campaign', { channel: 'telegram' }).channel, 'whatsapp')
  assert.equal(validateToolInput('activate_campaign', {}).channel, 'whatsapp')
})

test('activate_campaign truncates a runaway targetDay', () => {
  const action = validateToolInput('activate_campaign', { targetDay: 'x'.repeat(200) })
  assert.equal(action.targetDay.length, 32)
})

test('optional campaign fields are omitted, never fabricated', () => {
  // A missing audience must not become "1 contact", which would read as real.
  const minimal = validateToolInput('activate_campaign', { channel: 'whatsapp', targetDay: 'Sab 10' })
  assert.deepEqual(Object.keys(minimal).sort(), ['channel', 'targetDay'])

  const full = validateToolInput('activate_campaign', {
    channel: 'email',
    targetDay: 'Sab 10',
    audienceSize: 1842,
    expectedRevenueUsd: 1286,
  })
  assert.equal(full.audienceSize, 1842)
  assert.equal(full.expectedRevenueUsd, 1286)
})

test('zero is preserved for revenue but not treated as missing', () => {
  const action = validateToolInput('activate_campaign', { channel: 'sms', expectedRevenueUsd: 0 })
  assert.equal(action.expectedRevenueUsd, 0)
})

test('out-of-range campaign numbers are clamped', () => {
  const action = validateToolInput('activate_campaign', {
    audienceSize: 10 ** 9,
    expectedRevenueUsd: -500,
  })
  assert.equal(action.audienceSize, 500000)
  assert.equal(action.expectedRevenueUsd, 0)
})

test('adjust_reorder_point clamps units and caps the sku', () => {
  const action = validateToolInput('adjust_reorder_point', { sku: 'y'.repeat(200), newUnits: 0 })
  assert.equal(action.sku.length, 64)
  assert.equal(action.newUnits, 1)
})

test('a tool call with no input does not throw', () => {
  assert.doesNotThrow(() => validateToolInput('activate_campaign'))
  assert.doesNotThrow(() => validateToolInput('adjust_reorder_point'))
})