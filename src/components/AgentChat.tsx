import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import type { ChatMessage } from '../data/mock'
import { isApiConfigured, sendChatMessage, type AgentAction } from '../lib/api'
import { formatUsd } from '../lib/currency'
import { Reveal } from './ui/Reveal'
import { useI18n } from '../i18n/I18nProvider'

type Turn = { role: string; content: string }

/**
 * Converts an executed tool call into the metadata chip shown under the bubble,
 * so the agent's actions are visible instead of only claimed in prose.
 */
function describeAction(
  action: AgentAction,
  t: (key: string, vars?: Record<string, string | number>) => string,
  locale: 'es' | 'en',
): string {
  if (action.name === 'activate_campaign') {
    const channel = String(action.input.channel ?? 'whatsapp')
    const label = channel === 'whatsapp' ? 'WhatsApp' : channel.toUpperCase()
    const audience = action.input.audienceSize
    const revenueUsd = action.input.expectedRevenueUsd

    const extras = [
      audience ? `${Number(audience).toLocaleString(locale === 'en' ? 'en-US' : 'es-CO')} ${t('chat.contacts')}` : null,
      revenueUsd ? formatUsd(Number(revenueUsd), locale) : null,
    ].filter(Boolean)

    return `${t('chat.actionCampaign')} · ${label}${extras.length ? ` · ${extras.join(' · ')}` : ''}`
  }

  if (action.name === 'adjust_reorder_point') {
    return `${t('chat.actionReorder')} · ${action.input.sku ?? 'SKU'} → ${action.input.newUnits ?? '?'} ${t('chat.skuSuffix')}`
  }

  return `${t('chat.actionExecuted')} · ${action.name}`
}

/**
 * Conversational panel where the agent proposes actions and the user confirms.
 *
 * Talks to the Bedrock-backed `/chat` endpoint when the API is configured, and
 * falls back to canned replies when it is not, so the demo still works offline.
 */
export function AgentChat({ live }: { live: boolean }) {
  const { t, dict, locale } = useI18n()
  const reduceMotion = useReducedMotion()

  const initialMessages = useMemo<ChatMessage[]>(
    () =>
      dict.chat.initial.map((message, index) => ({
        id: index + 1,
        role: message.role as ChatMessage['role'],
        text: message.text,
        meta: message.meta,
      })),
    [dict],
  )

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const replyCount = useRef(0)
  const nextId = useRef(100)

  // Reset the transcript when the language changes so the demo stays coherent.
  useEffect(() => {
    setMessages(initialMessages)
    setNotice(null)
    nextId.current = 100
  }, [initialMessages])

  // Keep the newest message in view as the conversation grows.
  //
  // This scrolls the message list only. `scrollIntoView()` would walk every
  // scrollable ancestor including the window, which yanked the page down to the
  // next section every time the agent replied.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTo({ top: list.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
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
        const reply = dict.chat.replies[replyCount.current % dict.chat.replies.length]
        replyCount.current += 1
        setMessages((prev) => [
          ...prev,
          { id: nextId.current++, role: 'agent', text: reply, meta: t('chat.demoReplyNote') },
        ])
        setThinking(false)
      }, 700)
      return
    }

    try {
      const result = await sendChatMessage(text, history, locale)
      const actionNote = result.actions?.length
        ? describeAction(result.actions[0], t, locale)
        : t('chat.online')

      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'agent', text: result.reply, meta: actionNote },
      ])
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'error desconocido'
      const reply = dict.chat.replies[replyCount.current % dict.chat.replies.length]
      replyCount.current += 1
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: 'agent', text: reply, meta: t('chat.fallbackNote') },
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
{t('chat.badge')}
        </h2>
        <p className="mt-1.5 text-sm text-body">
          {t('chat.subtitle')}
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
              {live ? t('chat.online') : t('chat.offline')}
            </span>
          </div>

          {/* 420px was most of a 568px phone screen, which left the input below the fold.
          A viewport-relative cap on small screens keeps the conversation and the
          send button usable together. */}
          <div ref={listRef} className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-6 sm:max-h-[420px] sm:px-6">
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

</div>

          <div className="border-t border-line p-3 sm:p-4">
            {notice && (
              <p className="mb-2 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-[11px] text-gold">
                {notice}
              </p>
            )}

            <div className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-ink px-3 py-2 focus-within:border-gold/40">
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void send()
                }}
                placeholder={t('chat.placeholder')}
                aria-label="Instrucción para el agente"
                className="min-w-0 flex-1 bg-transparent px-1 py-1 text-sm text-white placeholder:text-white/30 focus:outline-none"
              />
              <motion.button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim() || thinking}
                whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                aria-label="Enviar instrucción"
                className="grid size-11 shrink-0 place-items-center rounded-lg bg-gradient-to-r from-gold to-gold-light text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30 sm:size-9"
              >
                <Send className="size-4" strokeWidth={2.5} />
              </motion.button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-white/25">
              {t('chat.hint')}
            </p>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

