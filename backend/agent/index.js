const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime')
const { buildForecastReport, buildSyntheticHistory } = require('../shared/forecast-engine.js')

const MODEL_ID = process.env.BEDROCK_MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'

// CORS is configured on the HTTP API itself (infra/template.yaml).
const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
}

const client = new BedrockRuntimeClient({ maxAttempts: 5, retryMode: 'adaptive' })

const MAX_TOKENS = 700
const MAX_TURNS = 12

/**
 * Tools the agent can actually invoke.
 *
 * These are the "actions" that make the demo more than a chatbot: the model
 * decides to call one, we validate its arguments, and we echo the resulting
 * action back to the UI as a confirmation chip.
 */
const TOOLS = [
  {
    toolSpec: {
      name: 'activate_campaign',
      description:
        'Programa una campaña de contacto para un día de alta demanda. Úsala cuando el usuario dé luz verde para activar, optimizar o enviar una campaña.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              enum: ['whatsapp', 'email', 'sms'],
              description: 'Canal de contacto.',
            },
            targetDay: {
              type: 'string',
              description: 'Etiqueta del día objetivo tal como aparece en el pronóstico, p.ej. "Vie 02".',
            },
            audienceSize: {
              type: 'integer',
              description: 'Número estimado de contactos.',
            },
            expectedRevenueCop: {
              type: 'integer',
              description: 'Recaudo adicional estimado en pesos colombianos.',
            },
          },
          required: ['channel', 'targetDay'],
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'adjust_reorder_point',
      description:
        'Ajusta el punto de reposición de inventario para cubrir un pico de demanda. Úsala si el usuario pide más stock, reorder o reposición.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            sku: { type: 'string', description: 'SKU o categoría affected.' },
            newUnits: { type: 'integer', description: 'Nuevo punto de reposición en unidades.' },
          },
          required: ['sku', 'newUnits'],
        },
      },
    },
  },
]

/**
 * POST /chat
 *
 * Body: { message: string, history?: { role, content }[] }
 *
 * Ground-truth is the statistical forecast, not a second LLM pass, so the
 * agent can never invent demand numbers: it reasons over numbers it did not
 * produce.
 */
async function handler(event) {
  try {
    const body = event.body ? JSON.parse(event.body) : {}
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!message) {
      return respond(400, { error: 'message_required' })
    }

    const history = Array.isArray(body.history) ? body.history.slice(-MAX_TURNS) : []
    const report = buildForecastReport(buildSyntheticHistory())
    const systemText = buildSystemPrompt(report)

    const conversation = [
      ...history.map(normaliseTurn).filter(Boolean),
      { role: 'user', content: [{ text: message }] },
    ]

    const first = await converse(conversation, systemText)

    // Tool use: execute what the model asked for, then let it explain.
    let actions = []
    let text = textOf(first)

    if (first.stopReason === 'tool_use') {
      const calls = (first.output?.message?.content ?? []).filter((block) => block.toolUse)
      const results = []
      actions = []

      for (const call of calls) {
        const safeInput = validateToolInput(call.toolUse.name, call.toolUse.input ?? {})
        actions.push({ name: call.toolUse.name, input: safeInput, status: 'executed' })
        results.push({
          toolResult: {
            toolUseId: call.toolUse.toolUseId,
            content: [{ text: JSON.stringify({ status: 'ok', ...safeInput }) }],
          },
        })
      }

      const second = await converse(
        [...conversation, first.output.message, { role: 'user', content: results }],
        systemText,
      )
      text = textOf(second)
    }

    const usage = first.usage ?? {}

    return respond(200, {
      reply: text,
      actions,
      context: summariseContext(report),
      model: MODEL_ID,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
    })
  } catch (error) {
    console.error('chat_failed', { name: error.name, message: error.message })
    return respond(500, { error: 'chat_failed', message: error.message })
  }
}

async function converse(messages, systemText) {
  return client.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      system: [{ text: systemText }],
      messages,
      toolConfig: { tools: TOOLS },
      inferenceConfig: { maxTokens: MAX_TOKENS, temperature: 0.4 },
    }),
  )
}

/**
 * Model output is untrusted input: clamp every value before it is echoed to
 * the UI or, in a future version, executed against a real campaign API.
 */
function validateToolInput(name, input) {
  if (name === 'activate_campaign') {
    const channels = ['whatsapp', 'email', 'sms']
    const channel = channels.includes(input.channel) ? input.channel : 'whatsapp'
    const action = {
      channel,
      targetDay: String(input.targetDay ?? '').slice(0, 32),
    }
    // Optional fields are omitted rather than defaulted: a fabricated audience
    // of "1 contact" reads as a real figure in the UI.
    if (input.audienceSize != null) action.audienceSize = clampInt(input.audienceSize, 1, 500000)
    if (input.expectedRevenueCop != null) action.expectedRevenueCop = clampInt(input.expectedRevenueCop, 0, 5000000000)
    return action
  }

  if (name === 'adjust_reorder_point') {
    return {
      sku: String(input.sku ?? '').slice(0, 64),
      newUnits: clampInt(input.newUnits, 1, 1000000),
    }
  }

  return {}
}

function clampInt(value, min, max) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return min
  return Math.min(Math.max(Math.round(numeric), min), max)
}

function textOf(response) {
  return (response.output?.message?.content ?? [])
    .map((block) => block.text)
    .filter(Boolean)
    .join('')
    .trim()
}

/** Keeps only well-formed user/assistant turns with non-empty text. */
function normaliseTurn(turn) {
  if (turn?.role !== 'user' && turn?.role !== 'assistant') return null
  const text = typeof turn.content === 'string' ? turn.content.trim() : ''
  if (!text) return null
  return { role: turn.role, content: [{ text: text.slice(0, 4000) }] }
}

function summariseContext(report) {
  return {
    weekAheadUnits: report.kpis.weekAheadUnits,
    weekAheadDeltaPct: report.kpis.weekAheadDeltaPct,
    peakDay: report.kpis.peakDay,
    peakUnits: report.kpis.peakUnits,
    modelWape: report.kpis.modelWape,
    unitsSavedPerDay: report.kpis.unitsSavedPerDay,
    inventorySavingsCop: report.kpis.inventorySavingsCop,
    model: report.model,
  }
}

const SYSTEM_PROMPT = `Eres el agente de decisión de Atelier Predict, una plataforma de pronóstico de demanda para retail colombiano.

Tu trabajo no es solo responder: es traducir un pronóstico en acciones concretas.

Reglas:
- Los únicos datos de demanda que puedes citar son los del CONTEXTO FORECAST. Nunca inventes cifras, fechas ni porcentajes.
- Responde siempre en español colombiano, tono profesional y directo. Máximo 4 frases.
- Cuando el usuario dé luz verde para activar una campaña, llama a la herramienta activate_campaign con el canal y el día del pico.
- Si el objetivo es inventario o stock, usa adjust_reorder_point.
- Cierra con una cifra concreta de impacto (unidades o pesos colombianos).
- No uses emojis. No uses markdown.`

/**
 * Injects the statistical forecast into the prompt.
 *
 * This is the important bit: the demand numbers come from Holt-Winters, not
 * from the LLM. The model narrates and acts; it never invents the forecast.
 */
function buildSystemPrompt(report) {
  const context = {
    modelo: report.model,
    demandaProximos7Dias: report.kpis.weekAheadUnits,
    variacionVsSemanaActualPct: report.kpis.weekAheadDeltaPct,
    diaPico: report.kpis.peakDay,
    unidadesDiaPico: report.kpis.peakUnits,
    errorWapePct: report.kpis.modelWape,
    unidadesAhorradasPorDia: report.kpis.unitsSavedPerDay,
    ahorroInventarioMensualCop: report.kpis.inventorySavingsCop,
    pronosticoDiario: report.forecast.slice(0, 7).map((point) => ({
      dia: point.label,
      unidades: point.value,
    })),
  }

  return `${SYSTEM_PROMPT}

CONTEXTO FORECAST (única fuente de verdad, generado por ${report.model}):
${JSON.stringify(context, null, 2)}`
}

function respond(statusCode, payload) {
  return { statusCode, headers: JSON_HEADERS, body: JSON.stringify(payload) }
}

module.exports = { handler }