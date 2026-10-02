import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import { INITIAL_MESSAGES, SCRIPTED_REPLIES, type ChatMessage } from '../data/mock'
import { isApiConfigured, sendChatMessage, type AgentAction } from '../lib/api'
import { Reveal } from './ui/Reveal'

type Turn = { role: string; content: string }

/**
 * Converts an executed tool call into the metadata chip shown under the bubble,
 * so the agent's actions are visible instead of only claimed in prose.
 */
function describeAction(action: AgentAction): string {
  if (action.name === 'activate_campaign') {
    const channel = String(action.input.channel ?? 'whatsapp')
    const label = channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()
    const audience = action.input.audienceSize
    const revenue = action.input.expectedRevenueCop

    const extras = [
      audience ? `${Number(audience).toLocaleString('es-CO')} contactos` : null,
      revenue ? `$${Number(revenue).toLocaleString('es-CO')} COP` : null,
    ].filter(Boolean)

    return `Campaña activada · ${label}${extras.length ? ` · ${extras.join(' · ')}` : ''}`
  }

  if (action.name === 'adjust_reorder_point') {
    return `Punto de reposición ajustado · ${action.input.sku ?? 'SKU'} → ${action.input.newUnits ?? '?'} unid.`
  }

  return `Acción ejecutada · ${action.name}`
}

/**
 * Conversational panel where the agent proposes actions and the user confirms.
 *
 * Talks to the Bedrock-backed `/chat` endpoint when the API is configured, and
 * falls back to canned replies when it is not, so the demo still works offline.
 */
export function AgentChat({ live }: { live: boolean }) {
  const reduceMotion = useReducedMotion()
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const replyCount = useRef(0)
  const nextId = useRef(INITIAL_MESSAGES.length + 1)

  // Keep the newest message in view as the conversation grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [messages, thinking, reduceMotion])

  const send = async () => {
    const text = draft.trim()
    if (!text || thinking) return

    // Prior turns sent as context; the pending message goes separately so the
    // UI echo and the API payload can never disagree.
    const history: Turn[] = messages
      .slice(-10)
      .map((message) => ({
        role: message.role === 'agent' ? 'assistant' : 'user',
        content: message.text,
      }))

    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', text }])
    setDraft('')
    setThinking(true)
    setNotice(null)

    if (!isApiConfigured) {
      // Local fallback so the panel is still usable with no API configured.
      window.setTimeout(() => {
        const reply = SCRIPTED_REPLIES[replyCount.current % SCRIPTED_REPLIES.length]
        replyCount.current += 1
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: 'agent', text: reply, meta: 'Respuesta local · sin API' },
        ])
        setThinking(false)
      }, 700)
      return
    }

    try {
      const result = await sendChatMessage(text, history)
      const actionNote = result.actions?.length
        ? describeAction(result.actions[0])
        : 'Contexto compartido desde el pronóstico'

      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'agent', text: result.reply, meta: actionNote },
      ])
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'error desconocido'
      const reply = SCRIPTED_REPLIES[replyCount.current % SCRIPTED_REPLIES.length]
      replyCount.current += 1
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'agent', text: reply, meta: 'Respuesta local · API no disponible' },
      ])
      setNotice(`No se pudo contactar al agente (${detail}). Se muestra una respuesta de demostración.`)
    } finally {
      setThinking(false)
    }
  }

  return (
    <section id="agente" className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Reveal className="mb-6">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-white sm:text-2xl">
          <Sparkles className="size-5 text-gold" strokeWidth={2} />
          Agente de decisión
        </h2>
        <p className="mt-1.5 text-sm text-body">
          Del pronóstico a la acción: el agente no solo predice, ejecuta.
        </p>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {/* Window chrome — reinforces the "agent console" feel. */}
          <div className="flex items-center gap-3 border-b border-line bg-surface-2/60 px-5 py-3.5">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-gold" />
            </span>
            <p className="text-sm font-medium text-white">agente.demanda</p>
            <span className="ml-auto text-xs text-body">
              {live ? 'En línea · Claude en Bedrock' : 'Sin conexión · respuestas locales'}
            </span>
          </div>

          <div className="max-h-[420px] space-y-4 overflow-y-auto px-4 py-6 sm:px-6">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={`flex gap-3 ${message.role === 'agent' ? 'justify-start' : 'justify-end'}`}
                >
                  {message.role === 'agent' && (
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2">
                      <Bot className="size-4 text-gold" strokeWidth={2} />
                    </span>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[75%] ${message.role === 'agent' ? '' : 'flex flex-col items-end'}`}
                  >
                    <p
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'agent'
                          ? 'rounded-tl-sm border border-line bg-surface-2 text-white'
                          : 'rounded-tr-sm bg-gradient-to-r from-gold to-gold-light text-black'
                      }`}
                    >
                      {message.text}
                    </p>

                    {message.meta && (
                      <span className="mt-1.5 text-[11px] text-white/35">{message.meta}</span>
                    )}
                  </div>

                  {message.role === 'user' && (
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-gold text-black">
                      <User className="size-4" strokeWidth={2.5} />
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {thinking && (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2">
                  <Bot className="size-4 text-gold" strokeWidth={2} />
                </span>
                <span className="flex gap-1 rounded-2xl rounded-tl-sm border border-line bg-surface-2 px-4 py-3.5">
                  {[0, 0.18, 0.36].map((delay) => (
                    <motion.span
                      key={delay}
                      className="size-1.5 rounded-full bg-gold/70"
                      animate={reduceMotion ? undefined : { opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay }}
                    />
                  ))}
                </span>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="border-t border-line p-3 sm:p-4">
            {notice && (
              <p className="mb-2 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-[11px] text-gold">
                {notice}
              </p>
            )}

            <div className="flex items-center gap-2 rounded-xl border border-line bg-ink px-3 py-2 focus-within:border-gold/40">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void send()
                }}
                placeholder="Escribe una instrucción al agente..."
                aria-label="Instrucción para el agente"
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
              <motion.button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || thinking}
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                aria-label="Enviar instrucción"
                className="grid size-9 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-gold to-gold-light text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Send className="size-4" strokeWidth={2.5} />
              </motion.button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-white/25">
              Enter para enviar · El agente responde con Claude (Amazon Bedrock) sobre el pronóstico.
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}