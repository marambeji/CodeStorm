import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Voix (Web Speech API, intégrée au navigateur, gratuite et hors ligne pour la synthèse) :
 * - useSpeak : lit un texte à voix haute
 * - useDictation : transforme la parole en texte (Chrome, Edge, Safari ; pas Firefox)
 */

export function useSpeak(lang = 'fr-FR') {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const [speaking, setSpeaking] = useState(false)

  const stop = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const speak = useCallback(
    (text: string) => {
      if (!supported) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = lang
      u.rate = 0.98
      // Choisit une voix de la bonne langue si le système en propose une
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang.slice(0, 2)))
      if (voice) u.voice = voice
      u.onend = () => setSpeaking(false)
      u.onerror = () => setSpeaking(false)
      setSpeaking(true)
      window.speechSynthesis.speak(u)
    },
    [lang, supported],
  )

  // On coupe la voix si le composant disparaît (changement de page)
  useEffect(() => stop, [stop])
  return { supported, speaking, speak, stop }
}

interface RecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start(): void
  stop(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

export function useDictation(lang = 'fr-FR') {
  const Ctor =
    typeof window !== 'undefined'
      ? ((window as unknown as { SpeechRecognition?: new () => RecognitionLike; webkitSpeechRecognition?: new () => RecognitionLike }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => RecognitionLike }).webkitSpeechRecognition)
      : undefined
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<RecognitionLike | null>(null)

  const start = useCallback(
    (onText: (text: string, final: boolean) => void) => {
      if (!Ctor) return
      const rec = new Ctor()
      rec.lang = lang
      rec.interimResults = true
      rec.continuous = false
      rec.onresult = (e) => {
        const results = Array.from(e.results)
        const text = results.map((r) => r[0].transcript).join(' ')
        onText(text, results.every((r) => r.isFinal))
      }
      rec.onerror = (e) =>
        setError(e.error === 'not-allowed' ? 'Micro refusé : autorisez-le dans les réglages du navigateur.' : 'Je n’ai pas compris, réessayez.')
      rec.onend = () => setListening(false)
      ref.current = rec
      setError(null)
      setListening(true)
      rec.start()
    },
    [Ctor, lang],
  )

  const stop = useCallback(() => ref.current?.stop(), [])
  useEffect(() => () => ref.current?.stop(), [])
  return { supported: Boolean(Ctor), listening, error, start, stop }
}
