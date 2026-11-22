import jsQR from 'jsqr'
import { AlertTriangle, BadgeCheck, Boxes, Camera, CameraOff, Download, ImageUp, Link2, Loader2, MapPin, PackageCheck, QrCode, ShieldAlert, ShieldCheck, Snowflake, Sprout, Store, Thermometer, Truck, Warehouse, type LucideIcon } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { categoryLabel, formatDate, formatQty } from '@/features/market/api'
import { OrganicBadge } from '@/features/market/components'
import { DeliveryMap, type MapStop } from '@/features/market/live-map'
import { cn } from '@/lib/utils'
import { actorLabel, parseLotCode, publicLotUrl, stageLabel, type Freshness, type FreshnessLevel, type HarvestLot, type Stage, type TraceBlock, type Verification } from './api'

// ─────────────────────────────── Étapes ───────────────────────────────

export const STAGE_ICON: Record<Stage, LucideIcon> = {
  recolte: Sprout,
  collecte: Boxes,
  transport: Truck,
  stockage: Warehouse,
  distribution: Store,
  vente: PackageCheck,
}

const STAGE_TONE: Record<Stage, string> = {
  recolte: 'bg-leaf/12 text-leaf-fg ring-leaf/30',
  collecte: 'bg-energy/12 text-energy-fg ring-energy/30',
  transport: 'bg-water/12 text-water-fg ring-water/30',
  stockage: 'bg-water/12 text-water-fg ring-water/30',
  distribution: 'bg-violet-500/12 text-violet-700 ring-violet-500/30 dark:text-violet-300',
  vente: 'bg-leaf/12 text-leaf-fg ring-leaf/30',
}

export function StagePill({ stage }: { stage: Stage }) {
  const Icon = STAGE_ICON[stage] ?? Boxes
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', STAGE_TONE[stage])}>
      <Icon className="size-3.5" aria-hidden="true" />
      {stageLabel(stage)}
    </span>
  )
}

// ─────────────────────────────── Fraîcheur (IA) ───────────────────────────────

export const FRESHNESS: Record<FreshnessLevel, { label: string; color: string; text: string }> = {
  excellente: { label: 'Excellente', color: '#10B981', text: 'text-leaf-fg' },
  bonne: { label: 'Bonne', color: '#84CC16', text: 'text-lime-700 dark:text-lime-300' },
  'a-consommer-vite': { label: 'À consommer rapidement', color: '#F59E0B', text: 'text-energy-fg' },
  limite: { label: 'Limite', color: '#F97316', text: 'text-orange-600 dark:text-orange-400' },
  perime: { label: 'Dépassée', color: '#EF4444', text: 'text-red-600 dark:text-red-400' },
}

const days = (d: number) => (d >= 60 ? `${Math.round(d / 30)} mois` : `${d.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} jour${d >= 2 ? 's' : ''}`)

/** Jauge circulaire de fraîcheur estimée */
export function FreshnessGauge({ freshness, size = 'md' }: { freshness: Freshness; size?: 'sm' | 'md' }) {
  const meta = FRESHNESS[freshness.level]
  const r = 42
  const c = 2 * Math.PI * r
  const dim = size === 'sm' ? 'size-16' : 'size-28'
  return (
    <div className="flex items-center gap-4">
      <div className={cn('relative shrink-0', dim)} role="img" aria-label={`Fraîcheur estimée ${freshness.score} sur 100 : ${meta.label}`}>
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-muted" />
          <circle cx="50" cy="50" r={r} fill="none" stroke={meta.color} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - freshness.score / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
        </svg>
        <span className={cn('absolute inset-0 flex items-center justify-center font-extrabold tabular-nums', size === 'sm' ? 'text-base' : 'text-2xl')}>{freshness.score}</span>
      </div>
      {size === 'md' && (
        <div className="space-y-1 text-sm">
          <p className={cn('text-base font-bold', meta.text)}>{meta.label}</p>
          <p className="text-muted-foreground">
            {freshness.level === 'perime' ? 'Durée de conservation dépassée' : <>Encore environ <strong className="text-foreground">{days(freshness.remainingDays)}</strong> (jusqu’au {formatDate(freshness.expiresAt)})</>}
          </p>
          <p className="text-xs text-muted-foreground">
            Conservation idéale : {days(freshness.shelfLifeDays)} à {freshness.idealC} °C
            {freshness.maxTempC !== null && <> · max relevé {freshness.maxTempC} °C</>}
            {!freshness.measured && <> · estimation sans relevé de température</>}
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────── Blockchain ───────────────────────────────

export function VerificationBadge({ verification, className }: { verification: Verification; className?: string }) {
  const ok = verification.valid && verification.certified
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', ok ? 'border-leaf/30 bg-leaf/10' : 'border-red-500/30 bg-red-500/10', className)}>
      {ok ? <ShieldCheck className="mt-0.5 size-5 shrink-0 text-leaf-fg" aria-hidden="true" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />}
      <div className="min-w-0 text-sm">
        <p className="font-semibold">{ok ? 'Origine certifiée · chaîne vérifiée' : 'Attention : traçabilité compromise'}</p>
        <p className="text-muted-foreground">
          {ok
            ? `${verification.length} bloc${verification.length > 1 ? 's' : ''} chaînés par empreinte SHA-256 : aucune donnée n’a été modifiée depuis son enregistrement.`
            : (verification.reason ?? 'Le sceau d’origine ne correspond pas.')}
        </p>
        {verification.lastHash && (
          <p className="mt-1 truncate font-mono text-[0.7rem] text-muted-foreground" title={verification.lastHash}>
            <Link2 className="me-1 inline size-3" aria-hidden="true" />
            {verification.lastHash}
          </p>
        )}
      </div>
    </div>
  )
}

/** Historique vérifiable : un bloc par étape, avec son empreinte et le lien vers le précédent */
export function ChainTimeline({ blocks, unit, brokenAt, showHashes = true }: { blocks: TraceBlock[]; unit: string; brokenAt?: number | null; showHashes?: boolean }) {
  return (
    <ol className="relative space-y-4 ps-8 before:absolute before:start-[0.9rem] before:top-2 before:bottom-2 before:w-px before:bg-border">
      {blocks.map((b) => {
        const Icon = STAGE_ICON[b.stage] ?? Boxes
        const broken = brokenAt !== null && brokenAt !== undefined && b.index >= brokenAt
        return (
          <li key={b.index} className="relative">
            <span className={cn('absolute -start-8 top-0.5 flex size-7 items-center justify-center rounded-full ring-4 ring-background', broken ? 'bg-red-500 text-white' : 'bg-foreground text-background')}>
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <div className="rounded-xl border bg-card/60 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {stageLabel(b.stage)} <span className="font-normal text-muted-foreground">· {actorLabel(b.actorRole)}</span>
                </p>
                <time className="text-xs text-muted-foreground tabular-nums" dateTime={b.createdAt}>
                  {formatDate(b.createdAt, true)}
                </time>
              </div>
              <p className="mt-1 text-sm">{b.actorName}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {b.placeName && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" /> {b.placeName}
                  </span>
                )}
                {b.temperature !== null && (
                  <span className="inline-flex items-center gap-1">
                    {b.temperature <= 8 ? <Snowflake className="size-3.5" aria-hidden="true" /> : <Thermometer className="size-3.5" aria-hidden="true" />} {b.temperature} °C
                  </span>
                )}
                {b.quantity !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Boxes className="size-3.5" aria-hidden="true" /> {formatQty(b.quantity, unit)}
                  </span>
                )}
              </div>
              {b.note && <p className="mt-2 text-sm text-muted-foreground italic">« {b.note} »</p>}
              {showHashes && (
                <p className="mt-2 truncate font-mono text-[0.65rem] text-muted-foreground" title={`hash ${b.hash}\nprécédent ${b.prevHash}`}>
                  #{b.index} · {b.hash.slice(0, 20)}… ← {b.prevHash.slice(0, 10)}…
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

// ─────────────────────────────── Passeport du lot ───────────────────────────────

/** Fiche complète d'un lot : origine, fraîcheur, carte du parcours, historique, responsabilités */
export function LotPassport({ lot, actions }: { lot: HarvestLot; actions?: ReactNode }) {
  const located = lot.blocks.filter((b) => b.lat !== null && b.lng !== null)
  const stops: MapStop[] = located.map((b, i) => ({ lat: b.lat!, lng: b.lng!, kind: b.stage === 'recolte' ? 'ferme' : 'client', label: `${stageLabel(b.stage)} · ${b.placeName ?? b.actorName}`, n: i + 1 }))
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl border bg-card/70 p-5 backdrop-blur sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wider">{lot.code}</span>
            <StagePill stage={lot.stage} />
            {lot.organic && <OrganicBadge />}
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {lot.product}
            {lot.variety && <span className="font-semibold text-muted-foreground"> · {lot.variety}</span>}
          </h2>
          <p className="text-sm text-muted-foreground">
            {categoryLabel(lot.category)} · {formatQty(lot.currentQuantity, lot.unit)}
            {lot.currentQuantity !== lot.quantity && <> (récolté : {formatQty(lot.quantity, lot.unit)})</>}
          </p>
          <dl className="grid gap-x-6 gap-y-1 pt-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-muted-foreground">Producteur : </dt>
              <dd className="inline font-medium">{lot.farmer.farmName || lot.farmer.name}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">Récolté le : </dt>
              <dd className="inline font-medium">{formatDate(lot.harvestDate)}</dd>
            </div>
            {(lot.parcel || lot.placeName) && (
              <div>
                <dt className="inline text-muted-foreground">Origine : </dt>
                <dd className="inline font-medium">{[lot.parcel, lot.farmer.placeName].filter(Boolean).join(', ')}</dd>
              </div>
            )}
          </dl>
          {actions && <div className="flex flex-wrap gap-2 pt-3">{actions}</div>}
        </div>
        <FreshnessGauge freshness={lot.freshness} />
      </div>

      <VerificationBadge verification={lot.verification} />

      {stops.length > 0 && <DeliveryMap stops={stops} path={stops.length > 1 ? stops.map((s) => [s.lat, s.lng]) : undefined} className="h-64" />}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <section aria-labelledby="hist-title">
          <h3 id="hist-title" className="mb-3 text-sm font-semibold text-muted-foreground">
            Historique du transport et des transactions
          </h3>
          <ChainTimeline blocks={lot.blocks} unit={lot.unit} brokenAt={lot.verification.brokenAt} />
        </section>
        <section aria-labelledby="resp-title">
          <h3 id="resp-title" className="mb-3 text-sm font-semibold text-muted-foreground">
            Responsabilités entre acteurs
          </h3>
          {lot.handovers.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Le lot est encore sous la responsabilité du producteur.</p>
          ) : (
            <ul className="space-y-2">
              {lot.handovers.map((h, i) => (
                <li key={i} className="rounded-xl border bg-card/60 p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{formatDate(h.at, true)}</p>
                  <p className="mt-1">
                    <span className="font-medium">{h.from}</span> <span className="text-muted-foreground">({actorLabel(h.fromRole)})</span>
                  </p>
                  <p className="text-muted-foreground">↓ remet à</p>
                  <p>
                    <span className="font-medium">{h.to}</span> <span className="text-muted-foreground">({actorLabel(h.toRole)})</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

// ─────────────────────────────── QR code ───────────────────────────────

/** QR code du lot (URL publique de traçabilité), téléchargeable en étiquette PNG */
export function LotQrCode({ code, size = 168, withDownload = true }: { code: string; size?: number; withDownload?: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    QRCode.toDataURL(publicLotUrl(code), { width: size * 2, margin: 1, errorCorrectionLevel: 'M' }).then((d) => alive && setSrc(d))
    return () => {
      alive = false
    }
  }, [code, size])
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="rounded-xl bg-white p-2 shadow-sm ring-1 ring-border" style={{ width: size + 16, height: size + 16 }}>
        {src ? <img src={src} alt={`QR code du lot ${code}`} width={size} height={size} /> : <Loader2 className="m-auto mt-[45%] animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>
      <span className="font-mono text-xs font-bold tracking-wider">{code}</span>
      {withDownload && src && (
        <Button asChild variant="outline" size="xs">
          <a href={src} download={`${code}.png`}>
            <Download aria-hidden="true" /> Étiquette PNG
          </a>
        </Button>
      )}
    </div>
  )
}

/** Décode un QR code dans une image importée (plusieurs tailles + couleurs inversées : photos floues ou petites) */
async function decodeQrFromFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  try {
    for (const max of [1600, 1000, 600]) {
      const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
      if (hit?.data) return hit.data
    }
    return null
  } finally {
    bitmap.close()
  }
}

type ScanMode = 'camera' | 'image'

/**
 * Scanner de QR code, trois façons :
 *   - caméra (arrière sur téléphone), décodée image par image avec jsQR ;
 *   - import d'une image (photo de l'étiquette, capture d'écran) : clic, glisser-déposer ou Ctrl+V ;
 *   - saisie manuelle de l'identifiant du lot.
 */
export function QrScannerDialog({ open, onClose, onCode, title = 'Scanner un QR code' }: { open: boolean; onClose: () => void; onCode: (code: string) => void; title?: string }) {
  const hasCamera = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const [mode, setMode] = useState<ScanMode>(hasCamera ? 'camera' : 'image')
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'starting' | 'live' | 'error'>('starting')
  const [manual, setManual] = useState('')
  const [manualError, setManualError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [imageState, setImageState] = useState<{ busy: boolean; error: string }>({ busy: false, error: '' })
  const [dragging, setDragging] = useState(false)
  // Dernier callback, sans redémarrer la caméra à chaque rendu du parent
  const onCodeRef = useRef(onCode)
  useEffect(() => {
    onCodeRef.current = onCode
  }, [onCode])

  // Réinitialise l'image importée à chaque ouverture
  useEffect(() => {
    if (!open) return
    setImageState({ busy: false, error: '' })
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p)
      return null
    })
  }, [open])

  // Caméra : seulement en mode « caméra », coupée dès qu'on change de mode ou qu'on ferme
  useEffect(() => {
    if (!open || mode !== 'camera') return
    let stream: MediaStream | null = null
    let raf = 0
    let done = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    setState('starting')

    const tick = () => {
      const v = videoRef.current
      if (done || !v || !ctx) return
      if (v.readyState >= 2 && v.videoWidth) {
        // Image réduite : décodage rapide même sur un téléphone modeste
        const scale = Math.min(1, 640 / v.videoWidth)
        canvas.width = Math.round(v.videoWidth * scale)
        canvas.height = Math.round(v.videoHeight * scale)
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const hit = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
        const code = hit && parseLotCode(hit.data)
        if (code) {
          done = true
          navigator.vibrate?.(60)
          onCodeRef.current(code)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('error')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        stream = s
        if (done || !videoRef.current) return s.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = s
        void videoRef.current.play()
        setState('live')
        raf = requestAnimationFrame(tick)
      })
      .catch(() => setState('error'))

    return () => {
      done = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [open, mode])

  async function handleFile(file: File | undefined | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) return setImageState({ busy: false, error: 'Choisissez une image (JPG, PNG, WebP…).' })
    setPreview((p) => {
      if (p) URL.revokeObjectURL(p)
      return URL.createObjectURL(file)
    })
    setImageState({ busy: true, error: '' })
    try {
      const text = await decodeQrFromFile(file)
      if (!text) return setImageState({ busy: false, error: 'Aucun QR code détecté. Recadrez la photo sur l’étiquette, bien nette et éclairée.' })
      const code = parseLotCode(text)
      if (!code) return setImageState({ busy: false, error: 'Ce QR code n’est pas un lot EcoNexus.' })
      setImageState({ busy: false, error: '' })
      onCodeRef.current(code)
    } catch {
      setImageState({ busy: false, error: 'Impossible de lire cette image.' })
    }
  }

  // Ctrl+V : coller une capture d'écran du QR code
  useEffect(() => {
    if (!open || mode !== 'image') return
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) void handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const submitManual = () => {
    const code = parseLotCode(manual)
    if (!code) return setManualError('Identifiant attendu : LOT- suivi de 6 caractères (ex : LOT-7K3Q9P).')
    onCode(code)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" aria-hidden="true" /> {title}
          </DialogTitle>
          <DialogDescription>Scannez le QR code de l’étiquette avec la caméra, importez une photo, ou saisissez l’identifiant.</DialogDescription>
        </DialogHeader>

        <div role="tablist" aria-label="Méthode de scan" className="grid grid-cols-2 rounded-xl bg-muted p-1 text-sm font-medium">
          {(
            [
              { id: 'camera', label: 'Caméra', icon: Camera },
              { id: 'image', label: 'Importer une image', icon: ImageUp },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mode === t.id}
              onClick={() => setMode(t.id)}
              className={cn('flex h-9 items-center justify-center gap-2 rounded-lg transition-colors', mode === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <t.icon className="size-4" aria-hidden="true" /> {t.label}
            </button>
          ))}
        </div>

        {mode === 'camera' ? (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} playsInline muted className="size-full object-cover" />
            {state === 'live' && <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,.35)]" aria-hidden="true" />}
            {state === 'starting' && (
              <div className="absolute inset-0 flex items-center justify-center text-white/80">
                <Camera className="size-6 animate-pulse" aria-hidden="true" />
              </div>
            )}
            {state === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-white/85">
                <CameraOff className="size-6" aria-hidden="true" />
                Caméra indisponible (autorisation refusée ou page non sécurisée).
                <Button type="button" size="sm" variant="secondary" onClick={() => setMode('image')}>
                  <ImageUp aria-hidden="true" /> Importer une image à la place
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void handleFile(e.dataTransfer.files[0])
            }}
            className={cn('relative flex aspect-square flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed p-6 text-center transition-colors', dragging ? 'border-leaf bg-leaf/10' : 'border-border bg-muted/40')}
          >
            {preview && <img src={preview} alt="Image importée" className="absolute inset-0 size-full object-contain opacity-30" />}
            <div className="relative flex flex-col items-center gap-3">
              {imageState.busy ? <Loader2 className="size-7 animate-spin text-muted-foreground" aria-hidden="true" /> : <ImageUp className="size-7 text-muted-foreground" aria-hidden="true" />}
              <p className="text-sm font-medium">{imageState.busy ? 'Lecture du QR code…' : 'Glissez une photo de l’étiquette ici'}</p>
              <p className="text-xs text-muted-foreground">ou collez une capture d’écran (Ctrl+V)</p>
              <Button type="button" variant="module" size="sm" onClick={() => fileRef.current?.click()} disabled={imageState.busy}>
                <ImageUp aria-hidden="true" /> Choisir une image
              </Button>
              {imageState.error && (
                <p role="alert" className="flex max-w-xs items-start gap-1.5 rounded-lg bg-background/90 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" /> {imageState.error}
                </p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                void handleFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </div>
        )}

        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            submitManual()
          }}
        >
          <p className="text-xs font-medium text-muted-foreground">Ou saisissez l’identifiant</p>
          <div className="flex gap-2">
            <Input
              value={manual}
              onChange={(e) => {
                setManual(e.target.value)
                setManualError('')
              }}
              placeholder="LOT-7K3Q9P"
              aria-label="Identifiant du lot"
              className="font-mono uppercase"
              aria-invalid={Boolean(manualError)}
            />
            <Button type="submit">Ouvrir</Button>
          </div>
          {manualError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="size-3.5" aria-hidden="true" /> {manualError}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function CertifiedMini({ verification }: { verification: Verification }) {
  const ok = verification.valid && verification.certified
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-leaf-fg">
      <BadgeCheck className="size-3.5" aria-hidden="true" /> Certifié
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">
      <ShieldAlert className="size-3.5" aria-hidden="true" /> Chaîne invalide
    </span>
  )
}
