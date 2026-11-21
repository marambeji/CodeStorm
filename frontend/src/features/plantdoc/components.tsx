import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Mic, MicOff, Send, Square, Volume2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useDictation, useSpeak } from '@/hooks/use-speech'
import { cn } from '@/lib/utils'
import { useAsk } from './api'
import { SEVERITY_STYLE, type Severity } from './types'

/** Badge de gravité : couleur d'état + libellé (jamais la couleur seule) */
export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const s = SEVERITY_STYLE[severity]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', s.className, className)}>
      <span className={cn('size-1.5 rounded-full', s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  )
}

/** Miniature : la photo envoyée, ou une illustration (diagnostics de démo sans photo) */
export function LeafThumb({ imageUrl, severity, className }: { imageUrl: string | null; severity: Severity; className?: string }) {
  if (imageUrl) return <img src={imageUrl} alt="Photo de la feuille analysée" loading="lazy" className={cn('object-cover', className)} />
  const spots = { aucune: 0, faible: 2, moyenne: 4, élevée: 7 }[severity]
  return (
    <svg viewBox="0 0 120 90" className={cn('bg-[#e9e4d6] dark:bg-[#26301f]', className)} role="img" aria-label="Illustration de feuille">
      <path d="M12 45 C30 12 86 10 110 45 C86 80 30 78 12 45 Z" fill="#3f8f3a" />
      <path d="M14 45 L108 45" stroke="#cfe8bd" strokeOpacity="0.6" strokeWidth="1.5" />
      {[30, 50, 70, 90].map((x) => (
        <path key={x} d={`M${x} 45 L${x + 10} 28 M${x} 45 L${x + 10} 62`} stroke="#cfe8bd" strokeOpacity="0.45" strokeWidth="1" />
      ))}
      {Array.from({ length: spots }, (_, i) => (
        <g key={i}>
          <circle cx={28 + ((i * 37) % 70)} cy={34 + ((i * 23) % 24)} r={6} fill="#d9c13c" opacity="0.8" />
          <circle cx={28 + ((i * 37) % 70)} cy={34 + ((i * 23) % 24)} r={4} fill="#5b3a1c" />
        </g>
      ))}
    </svg>
  )
}

/** Bouton "Écouter" : lit le texte à voix haute (et l'arrête) */
export function ListenButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'default' }) {
  const { supported, speaking, speak, stop } = useSpeak()
  if (!supported) return null
  return (
    <Button variant="outline" size={size} onClick={() => (speaking ? stop() : speak(text))} aria-pressed={speaking}>
      {speaking ? <Square className="fill-current" aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      {speaking ? 'Arrêter' : 'Écouter'}
    </Button>
  )
}

/** Poser une question sur un diagnostic, au clavier ou à la voix ; la réponse peut être écoutée */
export function AskBox({ diagnosisId }: { diagnosisId: string }) {
  const [question, setQuestion] = useState('')
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([])
  const ask = useAsk()
  const dictation = useDictation()
  const { speak } = useSpeak()

  async function submit(text: string) {
    const q = text.trim()
    if (q.length < 3) return
    try {
      const { answer } = await ask.mutateAsync({ id: diagnosisId, question: q })
      setAnswers((a) => [...a, { q, a: answer }])
      setQuestion('')
      return answer
    } catch {
      toast.error('La question n’a pas pu être envoyée. Vérifiez que le backend est lancé.')
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit(question)
  }

  function listen() {
    if (dictation.listening) return dictation.stop()
    dictation.start(async (text, final) => {
      setQuestion(text)
      if (final) {
        // Question dictée → réponse lue à voix haute automatiquement
        const answer = await submit(text)
        if (answer) speak(answer)
      }
    })
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {answers.map((x, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2 text-sm text-background">{x.q}</p>
            <div className="flex max-w-[92%] items-start gap-2">
              <p className="rounded-2xl rounded-bl-md bg-leaf/10 px-3.5 py-2 text-sm">{x.a}</p>
              <ListenButton text={x.a} />
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <label htmlFor={`ask-${diagnosisId}`} className="sr-only">
          Votre question
        </label>
        <input
          id={`ask-${diagnosisId}`}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={dictation.listening ? 'Je vous écoute…' : 'Ex : est-ce contagieux ? Quel traitement bio ?'}
          className="h-11 min-w-0 flex-1 rounded-xl border bg-background/60 px-3.5 text-sm outline-none focus-visible:border-ring"
          maxLength={300}
        />
        {dictation.supported && (
          <Button
            type="button"
            variant={dictation.listening ? 'destructive' : 'outline'}
            size="icon"
            onClick={listen}
            aria-label={dictation.listening ? 'Arrêter la dictée' : 'Poser la question à la voix'}
            className={cn('size-11 shrink-0', dictation.listening && 'animate-pulse')}
          >
            {dictation.listening ? <MicOff /> : <Mic />}
          </Button>
        )}
        <Button type="submit" variant="module" size="icon" className="size-11 shrink-0" disabled={question.trim().length < 3 || ask.isPending} aria-label="Envoyer la question">
          {ask.isPending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
      {dictation.error && <p className="text-xs text-destructive">{dictation.error}</p>}
    </div>
  )
}
