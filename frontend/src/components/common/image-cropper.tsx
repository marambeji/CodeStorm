import { Crop, RotateCw } from 'lucide-react'
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

/**
 * Recadrage simple : un rectangle à déplacer (glisser au centre) et à redimensionner
 * (poignée en bas à droite), au doigt ou à la souris. Renvoie l'image recadrée.
 */
type Rect = { x: number; y: number; w: number; h: number } // en proportion (0 → 1)

export function ImageCropper({
  src,
  initial = { x: 0.1, y: 0.35, w: 0.8, h: 0.3 },
  onCrop,
  label = 'Lire cette zone',
}: {
  src: string
  initial?: Rect
  onCrop: (file: File) => void
  label?: string
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [rect, setRect] = useState<Rect>(initial)
  // Rotation (°) pour remettre à l'horizontale des chiffres photographiés de biais
  const [angle, setAngle] = useState(0)

  function drag(e: ReactPointerEvent, mode: 'move' | 'resize') {
    e.preventDefault()
    e.stopPropagation()
    const box = boxRef.current!.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, ...rect }
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / box.width
      const dy = (ev.clientY - start.py) / box.height
      setRect(() => {
        if (mode === 'move') {
          return { ...start, x: Math.min(1 - start.w, Math.max(0, start.x + dx)), y: Math.min(1 - start.h, Math.max(0, start.y + dy)) }
        }
        return { ...start, w: Math.min(1 - start.x, Math.max(0.08, start.w + dx)), h: Math.min(1 - start.y, Math.max(0.05, start.h + dy)) }
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  async function crop() {
    const img = imgRef.current!
    const W = img.naturalWidth
    const H = img.naturalHeight
    // 1. Image tournée autour de son centre (même rendu que l'aperçu)
    const rotated = document.createElement('canvas')
    rotated.width = W
    rotated.height = H
    const rctx = rotated.getContext('2d')!
    rctx.translate(W / 2, H / 2)
    rctx.rotate((angle * Math.PI) / 180)
    rctx.drawImage(img, -W / 2, -H / 2)
    // 2. Découpe du cadre
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(rect.w * W))
    c.height = Math.max(1, Math.round(rect.h * H))
    c.getContext('2d')!.drawImage(rotated, rect.x * W, rect.y * H, c.width, c.height, 0, 0, c.width, c.height)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95))
    onCrop(new File([blob], 'recadrage.jpg', { type: 'image/jpeg' }))
  }

  return (
    <div className="space-y-3">
      <div ref={boxRef} className="relative w-full touch-none overflow-hidden rounded-2xl bg-black select-none">
        <img ref={imgRef} src={src} alt="Photo à recadrer" className="block w-full" style={{ transform: `rotate(${angle}deg)` }} draggable={false} />
        <div
          role="slider"
          aria-label="Zone à lire : glissez pour déplacer"
          aria-valuenow={Math.round(rect.x * 100)}
          tabIndex={0}
          onPointerDown={(e) => drag(e, 'move')}
          className="absolute cursor-move rounded-lg border-2 border-water shadow-[0_0_0_9999px_rgb(0_0_0/0.55)]"
          style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
        >
          <span
            onPointerDown={(e) => drag(e, 'resize')}
            aria-label="Redimensionner la zone"
            className="absolute -right-3 -bottom-3 size-7 cursor-se-resize rounded-full border-2 border-white bg-water shadow"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <RotateCw className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span id="crop-rot" className="shrink-0 text-xs text-muted-foreground">
          Rotation
        </span>
        <Slider aria-labelledby="crop-rot" min={-45} max={45} step={1} value={[angle]} onValueChange={([v]) => setAngle(v)} />
        <span className="tabular w-10 shrink-0 text-end text-xs font-semibold">{angle}°</span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Remettez les chiffres à l’horizontale, puis encadrez uniquement les rouleaux (glissez le cadre, tirez le rond pour l’agrandir).</p>
        <Button type="button" variant="module" size="sm" onClick={crop}>
          <Crop aria-hidden="true" /> {label}
        </Button>
      </div>
    </div>
  )
}
