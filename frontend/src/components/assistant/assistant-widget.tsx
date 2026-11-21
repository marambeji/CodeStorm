import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, Bot, Loader2, Mic, MicOff, RotateCcw, Send, Sparkles, Square, Volume2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useDictation, useSpeak } from '@/hooks/use-speech'
import { api } from '@/lib/api'
import { onAppEvent } from '@/lib/events'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  links?: { label: string; to: string }[]
}
interface Reply {
  reply: string
  links: { label: string; to: string }[]
  suggestions: string[]
  source: 'mock' | 'llm'
}

const STORAGE = 'assistant-conversation'
const VOICE_LANG: Record<string, string> = { fr: 'fr-FR', en: 'en-GB', ar: 'ar-SA' }

/**
 * Assistant IA flottant, disponible sur toutes les pages.
 * Il répond à partir des données réelles de l'application (POST /api/assistant/chat).
 * Saisie au clavier ou à la voix ; chaque réponse peut être écoutée.
 */
export function AssistantWidget() {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE) ?? '[]') as Message[]
    } catch {
      return []
    }
  })
  const [suggestions, setSuggestions] = useState<string[]>([])
  const listRef = useRef<HTMLDivElement>(null)
  const voiceLang = VOICE_LANG[i18n.language] ?? 'fr-FR'
  const dictation = useDictation(voiceLang)
  const { speak, stop, speaking } = useSpeak(voiceLang)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)

  // Les pages carte (TerraCalc, HydroMap) ont un panneau en bas sur mobile : on remonte le bouton
  const mapPage = /^\/app\/(terracalc\/.+|hydromap)/.test(pathname)

  const chat = useMutation({
    mutationFn: async (history: Message[]) =>
      (await api.post<Reply>('/assistant/chat', { messages: history.map(({ role, content }) => ({ role, content })).slice(-20), lang: i18n.language, page: pathname })).data,
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(messages.slice(-30)))
    } catch {
      /* non bloquant */
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, chat.isPending])

  // Ouverture depuis la palette Ctrl+K
  useEffect(() => onAppEvent('assistant', () => setOpen(true)), [])

  // Changement de langue : les suggestions reviennent à celles de la nouvelle langue
  useEffect(() => setSuggestions([]), [i18n.language])

  // Échap ferme la fenêtre
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function send(text: string, speakAnswer = false) {
    const content = text.trim()
    if (!content || chat.isPending) return
    const history: Message[] = [...messages, { role: 'user', content }]
    setMessages(history)
    setInput('')
    try {
      const r = await chat.mutateAsync(history)
      setMessages((m) => [...m, { role: 'assistant', content: r.reply, links: r.links }])
      setSuggestions(r.suggestions)
      if (speakAnswer) {
        speak(r.reply)
        setSpeakingIndex(history.length)
      }
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: t('assistant.error') }])
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    send(input)
  }

  function toggleDictation() {
    if (dictation.listening) return dictation.stop()
    dictation.start((text, final) => {
      setInput(text)
      if (final) send(text, true) // question dictée → réponse lue à voix haute
    })
  }

  return (
    <>
      {/* Bouton flottant */}
      <AnimatePresence>
        {!open && (
          <motion.button
            key="fab"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            aria-label={t('assistant.open')}
            className={cn(
              'fixed end-4 z-[800] flex size-14 items-center justify-center rounded-full text-white shadow-[0_12px_32px_-8px_rgb(14_165_233/0.65)] sm:end-6',
              mapPage ? 'bottom-[228px] lg:bottom-6' : 'bottom-4 sm:bottom-6',
            )}
          >
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-[conic-gradient(from_180deg,#10B981,#0EA5E9,#F59E0B,#10B981)]" />
            <span aria-hidden="true" className="animate-ping-slow absolute inset-0 rounded-full bg-water/40" />
            <Sparkles className="relative size-6" aria-hidden="true" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Fenêtre de discussion */}
      <AnimatePresence>
        {open && (
          <motion.section
            key="panel"
            role="dialog"
            aria-label={t('assistant.title')}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="glass fixed inset-0 z-[850] flex flex-col overflow-hidden border shadow-[var(--shadow-float)] sm:inset-auto sm:end-6 sm:bottom-6 sm:h-[min(640px,calc(100svh-3rem))] sm:w-[400px] sm:rounded-3xl"
          >
            {/* En-tête */}
            <header className="flex items-center gap-3 border-b px-4 py-3">
              <span className="relative flex size-10 items-center justify-center rounded-2xl bg-[conic-gradient(from_180deg,#10B981,#0EA5E9,#F59E0B,#10B981)] p-[2px]">
                <span className="flex size-full items-center justify-center rounded-[14px] bg-background">
                  <Bot className="size-5" aria-hidden="true" />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{t('assistant.title')}</p>
                <p className="truncate text-xs text-muted-foreground">{t('assistant.subtitle')}</p>
              </div>
              {messages.length > 0 && (
                <Button variant="ghost" size="icon-sm" onClick={() => (setMessages([]), setSuggestions([]), stop())} aria-label={t('assistant.reset')} title={t('assistant.reset')}>
                  <RotateCcw />
                </Button>
              )}
              <Button variant="ghost" size="icon-sm" onClick={() => (setOpen(false), stop())} aria-label={t('assistant.close')}>
                <X />
              </Button>
            </header>

            {/* Messages */}
            <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
              <Bubble role="assistant">{t('assistant.hello')}</Bubble>
              {messages.map((m, i) => (
                <div key={i} className="space-y-2">
                  <Bubble role={m.role}>{m.content}</Bubble>
                  {m.role === 'assistant' && (
                    <div className="flex flex-wrap items-center gap-1.5 ps-1">
                      <button
                        onClick={() => {
                          if (speaking && speakingIndex === i) return stop()
                          speak(m.content)
                          setSpeakingIndex(i)
                        }}
                        className="flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        {speaking && speakingIndex === i ? <Square className="size-3 fill-current" aria-hidden="true" /> : <Volume2 className="size-3.5" aria-hidden="true" />}
                        {speaking && speakingIndex === i ? t('assistant.stop') : t('assistant.listen')}
                      </button>
                      {m.links?.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => setOpen(false)}
                          className="flex h-8 items-center gap-1 rounded-full bg-water/12 px-3 text-xs font-semibold text-water-fg hover:bg-water/20"
                        >
                          {l.label} <ArrowUpRight className="size-3.5 rtl:-scale-x-100" aria-hidden="true" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {chat.isPending && (
                <div className="flex w-fit items-center gap-1 rounded-2xl rounded-es-md bg-muted px-4 py-3" aria-label="…">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} className="size-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
                  ))}
                </div>
              )}
            </div>

            {/* Suggestions */}
            {!chat.isPending && (
              <div className="flex gap-2 overflow-x-auto px-4 pb-2">
                {(suggestions.length ? suggestions : DEFAULT_SUGGESTIONS[i18n.language as 'fr'] ?? DEFAULT_SUGGESTIONS.fr).map((s) => (
                  <button key={s} onClick={() => send(s)} className="h-8 shrink-0 rounded-full border bg-background/60 px-3 text-xs font-medium hover:bg-muted">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Saisie */}
            <form onSubmit={onSubmit} className="flex items-center gap-2 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <label htmlFor="assistant-input" className="sr-only">
                {t('assistant.placeholder')}
              </label>
              <input
                id="assistant-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={dictation.listening ? t('assistant.listening') : t('assistant.placeholder')}
                maxLength={1000}
                autoComplete="off"
                className="h-11 min-w-0 flex-1 rounded-xl border bg-background/70 px-3.5 text-sm outline-none focus-visible:border-ring"
              />
              {dictation.supported && (
                <Button
                  type="button"
                  variant={dictation.listening ? 'destructive' : 'outline'}
                  size="icon"
                  className={cn('size-11 shrink-0', dictation.listening && 'animate-pulse')}
                  onClick={toggleDictation}
                  aria-label={dictation.listening ? t('assistant.stopVoice') : t('assistant.voice')}
                >
                  {dictation.listening ? <MicOff /> : <Mic />}
                </Button>
              )}
              <Button type="submit" size="icon" className="size-11 shrink-0" disabled={!input.trim() || chat.isPending} aria-label={t('assistant.send')}>
                {chat.isPending ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}
              </Button>
            </form>
            <p className="pb-2 text-center text-[0.65rem] text-muted-foreground">{t('assistant.simulated')}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

const DEFAULT_SUGGESTIONS = {
  fr: ['Ai-je une fuite d’eau ?', 'Comment baisser ma facture ?', 'Quelles cultures sont malades ?', 'Explique mon éco-score'],
  en: ['Do I have a water leak?', 'How can I lower my bill?', 'Which crops are sick?', 'Explain my eco-score'],
  ar: ['هل يوجد تسرب للمياه؟', 'كيف أخفض فاتورتي؟', 'ما هي المحاصيل المريضة؟', 'اشرح مؤشري البيئي'],
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'w-fit max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line',
        role === 'user' ? 'ms-auto rounded-ee-md bg-foreground text-background' : 'rounded-es-md bg-muted',
      )}
    >
      {children}
    </motion.p>
  )
}
