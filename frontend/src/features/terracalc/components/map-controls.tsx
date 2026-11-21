import { motion } from 'framer-motion'
import { Columns2, History, Map as MapIcon, Minus, Plus, Satellite } from 'lucide-react'
import { useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { SENTINEL_YEARS, type BaseLayer } from '../layers'
import type { LayerState } from './terra-map'

const BASES: { id: BaseLayer; label: string; icon: typeof MapIcon }[] = [
  { id: 'satellite', label: 'Satellite', icon: Satellite },
  { id: 'plan', label: 'Plan', icon: MapIcon },
  { id: 'historique', label: 'Historique', icon: History },
]

/** Sélecteur de fond de carte (segmenté, avec pastille animée) + zoom */
export function LayerSwitcher({
  value,
  onChange,
  onZoom,
  className,
}: {
  value: BaseLayer
  onChange: (b: BaseLayer) => void
  onZoom?: (delta: 1 | -1) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div role="radiogroup" aria-label="Fond de carte" className="glass flex rounded-xl border p-1 shadow-[var(--shadow-float)]">
        {BASES.map((b) => (
          <button
            key={b.id}
            role="radio"
            aria-checked={value === b.id}
            onClick={() => onChange(b.id)}
            className={cn(
              'relative flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors sm:px-3',
              value === b.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {value === b.id && <motion.span layoutId="tc-base" className="absolute inset-0 -z-10 rounded-lg bg-background shadow-sm ring-1 ring-border" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <b.icon className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">{b.label}</span>
            <span className="sr-only sm:hidden">{b.label}</span>
          </button>
        ))}
      </div>
      {onZoom && (
        <div className="glass hidden flex-col overflow-hidden rounded-xl border shadow-[var(--shadow-float)] sm:flex">
          <button onClick={() => onZoom(1)} className="flex size-9 items-center justify-center hover:bg-muted" aria-label="Zoomer">
            <Plus className="size-4" />
          </button>
          <button onClick={() => onZoom(-1)} className="flex size-9 items-center justify-center border-t hover:bg-muted" aria-label="Dézoomer">
            <Minus className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

/** Frise des années Sentinel-2 + mode comparaison avant / après */
export function Timeline({ layers, onChange, className }: { layers: LayerState; onChange: (l: Partial<LayerState>) => void; className?: string }) {
  const index = SENTINEL_YEARS.indexOf(layers.year)
  const [a, b] = layers.compareYears

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className={cn('glass w-full rounded-2xl border p-4 shadow-[var(--shadow-float)]', className)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Images satellite par année</p>
          <p className="text-xs text-muted-foreground">Sentinel-2, 10 m par pixel</p>
        </div>
        <button
          onClick={() => onChange({ compare: !layers.compare })}
          aria-pressed={layers.compare}
          className={cn(
            'flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors',
            layers.compare ? 'border-transparent bg-foreground text-background' : 'hover:bg-muted',
          )}
        >
          <Columns2 className="size-4" aria-hidden="true" /> Comparer
        </button>
      </div>

      {layers.compare ? (
        <div className="grid grid-cols-2 gap-3">
          <YearPicker label="Avant" value={a} onChange={(y) => onChange({ compareYears: [y, b] })} />
          <YearPicker label="Après" value={b} onChange={(y) => onChange({ compareYears: [a, y] })} />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span id="tc-year" className="text-xs text-muted-foreground">
              Année affichée
            </span>
            <span className="tabular text-2xl font-extrabold tracking-tight">{layers.year}</span>
          </div>
          <Slider
            aria-labelledby="tc-year"
            min={0}
            max={SENTINEL_YEARS.length - 1}
            step={1}
            value={[index]}
            onValueChange={([i]) => onChange({ year: SENTINEL_YEARS[i] })}
          />
          <div className="flex justify-between text-[0.65rem] text-muted-foreground" aria-hidden="true">
            {SENTINEL_YEARS.map((y, i) => (
              <span key={y} className={cn('tabular', i % 3 !== 0 && i !== SENTINEL_YEARS.length - 1 && 'hidden sm:inline')}>
                {y}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

function YearPicker({ label, value, onChange }: { label: string; value: number; onChange: (y: number) => void }) {
  const id = `tc-year-${label}`
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="tabular h-10 w-full rounded-lg border bg-background px-2 text-sm font-semibold"
      >
        {SENTINEL_YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Séparateur vertical de la comparaison : à glisser à la souris, au doigt ou au clavier (← →).
 */
export function CompareDivider({ value, years, onChange }: { value: number; years: [number, number]; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  function onPointerDown(e: PointerEvent) {
    const area = ref.current?.parentElement
    if (!area) return
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    const move = (ev: globalThis.PointerEvent) => {
      const r = area.getBoundingClientRect()
      onChange(Math.min(0.98, Math.max(0.02, (ev.clientX - r.left) / r.width)))
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') onChange(Math.max(0.02, value - 0.05))
    if (e.key === 'ArrowRight') onChange(Math.min(0.98, value + 0.05))
  }

  return (
    <div ref={ref} className="pointer-events-none absolute inset-y-0 z-[450] w-0" style={{ left: `${value * 100}%` }}>
      <div className="absolute inset-y-0 -left-px w-0.5 bg-white shadow-[0_0_12px_rgb(0_0_0/0.5)]" />
      <span className="absolute top-20 right-3 rounded-md bg-black/60 px-2 py-1 text-xs font-bold text-white backdrop-blur lg:top-24">{years[0]}</span>
      <span className="absolute top-20 left-3 rounded-md bg-black/60 px-2 py-1 text-xs font-bold text-white backdrop-blur lg:top-24">{years[1]}</span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Séparateur de comparaison"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        className="pointer-events-auto absolute top-1/2 left-0 flex size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-full border-2 border-white bg-black/50 text-white shadow-lg backdrop-blur"
      >
        <Columns2 className="size-4" aria-hidden="true" />
      </div>
    </div>
  )
}
