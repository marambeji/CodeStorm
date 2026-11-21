import { Camera, CameraOff, Loader2, RefreshCw, SwitchCamera } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

/**
 * Caméra en direct (webcam sur ordinateur, caméra arrière sur téléphone) via getUserMedia.
 *
 * `guide` : affiche un cadre de visée ; la photo envoyée est alors RECADRÉE sur ce cadre
 * (idéal pour l'OCR d'un compteur : seuls les chiffres sont lus).
 *
 * Remarque : les navigateurs n'autorisent la caméra que sur https:// ou http://localhost.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
  title,
  hint,
  guide,
}: {
  open: boolean
  onClose: () => void
  onCapture: (file: File, full: File) => void
  title: string
  hint?: string
  /** Cadre de visée en proportion de l'image (ex : { width: 0.8, height: 0.25 }) */
  guide?: { width: number; height: number }
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting')
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  // Proportions réelles de la vidéo : le cadre affiché = la zone réellement recadrée
  const [aspect, setAspect] = useState(16 / 9)

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    if (!open) return stop()
    let cancelled = false
    async function start() {
      setState('starting')
      stop()
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setError('La caméra n’est disponible que sur une adresse sécurisée (https:// ou localhost). Utilisez « Choisir une photo ».')
        setState('error')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) return stream.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setState('live')
      } catch (e) {
        const name = (e as DOMException).name
        setError(
          name === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Autorisez-le dans la barre d’adresse du navigateur, puis réessayez.'
            : name === 'NotFoundError'
              ? 'Aucune caméra détectée sur cet appareil.'
              : 'La caméra n’a pas pu démarrer (peut-être utilisée par une autre application).',
        )
        setState('error')
      }
    }
    start()
    return () => {
      cancelled = true
    }
  }, [open, facing, stop, retry])

  async function capture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    const full = document.createElement('canvas')
    full.width = vw
    full.height = vh
    full.getContext('2d')!.drawImage(video, 0, 0)

    // Recadrage sur le cadre de visée (même proportions que l'overlay, centré)
    let out = full
    if (guide) {
      const cw = Math.round(vw * guide.width)
      const ch = Math.round(vh * guide.height)
      out = document.createElement('canvas')
      out.width = cw
      out.height = ch
      out.getContext('2d')!.drawImage(full, Math.round((vw - cw) / 2), Math.round((vh - ch) / 2), cw, ch, 0, 0, cw, ch)
    }
    const toFile = (c: HTMLCanvasElement, name: string) =>
      new Promise<File>((resolve) => c.toBlob((b) => resolve(new File([b!], name, { type: 'image/jpeg' })), 'image/jpeg', 0.92))
    const [cropped, original] = await Promise.all([toFile(out, 'capture-cadre.jpg'), toFile(full, 'capture.jpg')])
    stop()
    onCapture(cropped, original)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[calc(100vw-1.5rem)] gap-4 p-4 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {hint && <DialogDescription>{hint}</DialogDescription>}
        </DialogHeader>
        <div className="relative mx-auto max-h-[65svh] w-full overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: aspect, maxWidth: `calc(65svh * ${aspect})` }}>
          {/* Le cadre a les proportions de la vidéo : l'image affichée = l'image capturée */}
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={(e) => e.currentTarget.videoWidth && setAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight)}
            className="size-full object-cover"
          />
          {state === 'live' && guide && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-xl border-2 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
                style={{ width: `${guide.width * 100}%`, height: `${guide.height * 100}%` }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white">
                  Placez les chiffres dans le cadre
                </span>
              </div>
            </div>
          )}
          {state === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center text-white/80">
              <Loader2 className="size-6 animate-spin" aria-label="Démarrage de la caméra" />
            </div>
          )}
          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <CameraOff className="size-8" aria-hidden="true" />
              <p className="max-w-sm text-sm">{error}</p>
              <Button size="sm" variant="outline" className="bg-white/10 text-white" onClick={() => setRetry((r) => r + 1)}>
                <RefreshCw aria-hidden="true" /> Réessayer
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} disabled={state !== 'live'}>
            <SwitchCamera aria-hidden="true" /> Changer de caméra
          </Button>
          <Button size="lg" variant="module" onClick={capture} disabled={state !== 'live'}>
            <Camera aria-hidden="true" /> Capturer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
