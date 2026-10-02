/**
 * Clamps model-produced tool arguments.
 *
 * Bedrock output is untrusted input. Every value that reaches the UI or, later, a
 * real campaign API passes through here first.
 */

const CHANNELS = ['whatsapp', 'email', 'sms']

const LIMITS = {
  audienceSize: { min: 1, max: 500000 },
  expectedRevenueCop: { min: 0, max: 5000000000 },
  newUnits: { min: 1, max: 1000000 },
  skuLength: 64,
  targetDayLength: 32,
}

function clampInt(value, { min, max }) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.min(Math.max(Math.round(numeric), min), max)
}

function clampText(value, max) {
  return String(value === undefined || value === null ? '' : value).slice(0, max)
}

/**
 * Normalises one tool call into a safe, typed shape.
 *
 * Optional fields are omitted rather than defaulted: a fabricated audience of
 * "1 contact" reads as a real figure in the UI, which is worse than no figure.
 */
function validateToolInput(name, input) {
  const source = input || {}

  if (name === 'activate_campaign') {
    const action = {
      channel: CHANNELS.includes(source.channel) ? source.channel : 'whatsapp',
      targetDay: clampText(source.targetDay, LIMITS.targetDayLength),
    }
    if (source.audienceSize !== undefined && source.audienceSize !== null) {
      action.audienceSize = clampInt(source.audienceSize, LIMITS.audienceSize)
    }
    if (source.expectedRevenueCop !== undefined && source.expectedRevenueCop !== null) {
      action.expectedRevenueCop = clampInt(source.expectedRevenueCop, LIMITS.expectedRevenueCop)
    }
    return action
  }

  if (name === 'adjust_reorder_point') {
    return {
      sku: clampText(source.sku, LIMITS.skuLength),
      newUnits: clampInt(source.newUnits, LIMITS.newUnits),
    }
  }

  return {}
}

module.exports = { CHANNELS, LIMITS, clampInt, clampText, validateToolInput }