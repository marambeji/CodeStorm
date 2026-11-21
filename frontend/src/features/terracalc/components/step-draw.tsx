import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowRight, Check, Eraser, Info, PenLine, Trash2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/common/animated-number'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatLength, formatNumber, isValidShape, type Measures } from '../geo'
import type { Drawing } from '../use-drawing'

const fmtM2 = (n: number) => formatNumber(n)
const fmtHa = (n: number) => formatNumber(n / 10_000, 2)
const fmtLen = (n: number) => formatLength(n)

/** Étape 1 : outils de dessin + mesures en direct */
export function StepDraw({ drawing, measures, onNext }: { drawing: Drawing; measures: Measures; onNext: () => void }) {
  const { points, mode, selected } = drawing
  const valid = isValidShape(measures)

  return (
    <div className="space-y-5">
      {/* Outils */}
      <div className="grid grid-cols-4 gap-2" role="toolbar" aria-label="Outils de dessin">
        {mode === 'draw' && points.length >= 3 ? (
          <Tool icon={<Check />} label="Terminer" onClick={() => drawing.setMode('edit')} highlight />
        ) : (
          <Tool
            icon={<PenLine />}
            label={mode === 'draw' ? 'Dessin…' : 'Ajouter'}
            onClick={() => drawing.setMode('draw')}
            active={mode === 'draw'}
            disabled={mode === 'draw'}
          />
        )}
        <Tool icon={<Undo2 />} label="Annuler" onClick={drawing.undo} disabled={!drawing.canUndo} />
        <Tool icon={<Trash2 />} label="Suppr. point" onClick={() => selected !== null && drawing.remove(selected)} disabled={selected === null} />
        <Tool icon={<Eraser />} label="Tout effacer" onClick={drawing.clear} disabled={!points.length} />
      </div>

      <Hint measures={measures} drawing={drawing} />

      {/* Mesures */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl border bg-background/50 p-4">
          <p className="text-xs font-medium text-muted-foreground">Surface</p>
          <p className="mt-1 flex items-baseline gap-2">
            <AnimatedNumber value={measures.areaM2} format={fmtM2} className="text-4xl font-extrabold tracking-[-0.03em]" />
            <span className="text-sm font-semibold text-muted-foreground">m²</span>
          </p>
          <p className="mt-1 text-sm text-leaf-fg">
            <AnimatedNumber value={measures.areaM2} format={fmtHa} className="font-bold" /> hectares
          </p>
        </div>
        <Metric label="Périmètre">
          <AnimatedNumber value={measures.perimeterM} format={fmtLen} />
        </Metric>
        <Metric label="Points">
          <span className="tabular">{measures.vertexCount}</span>
        </Metric>
        <Metric label="Centre du terrain" className="col-span-2">
          {measures.centroid ? (
            <span className="tabular text-sm">
              {measures.centroid[0].toFixed(5)}°, {measures.centroid[1].toFixed(5)}°
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Placez au moins 3 points</span>
          )}
        </Metric>
      </div>

      <Button size="lg" variant="module" className="w-full" disabled={!valid} onClick={onNext}>
        Choisir la culture <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  )
}

function Hint({ measures, drawing }: { measures: Measures; drawing: Drawing }) {
  const n = drawing.points.length
  let tone: 'info' | 'warn' = 'info'
  let text: string
  if (measures.selfIntersects) {
    tone = 'warn'
    text = 'Le contour se croise. Déplacez un point ou annulez la dernière action.'
  } else if (n === 0) text = 'Cliquez sur la carte pour placer le premier coin de votre terrain. Recherchez d’abord votre ville si besoin.'
  else if (n < 3) text = `Encore ${3 - n} point${3 - n > 1 ? 's' : ''} au minimum pour former un terrain.`
  else if (drawing.mode === 'draw') text = 'Continuez à cliquer pour suivre le contour, puis touchez le premier point (il clignote) ou « Terminer ».'
  else if (measures.areaM2 < 50) {
    tone = 'warn'
    text = 'Le terrain est trop petit (minimum 50 m²). Écartez les points.'
  } else text = 'Faites glisser un point pour l’ajuster, touchez un petit rond blanc pour en ajouter un, ou sélectionnez un point pour le supprimer.'

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.p
        key={text}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18 }}
        role="status"
        className={cn(
          'flex gap-2.5 rounded-xl px-3.5 py-3 text-sm',
          tone === 'warn' ? 'bg-energy/12 text-energy-fg' : 'bg-leaf/10 text-foreground/85',
        )}
      >
        {tone === 'warn' ? <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0 text-leaf-fg" aria-hidden="true" />}
        {text}
      </motion.p>
    </AnimatePresence>
  )
}

function Tool({ icon, label, onClick, disabled, active, highlight }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; active?: boolean; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !active}
      aria-pressed={active}
      className={cn(
        'flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border px-1 text-[0.7rem] font-semibold transition-all active:scale-95 disabled:opacity-40 [&_svg]:size-[18px]',
        highlight && 'border-transparent bg-leaf text-[#0b1120] shadow-[0_8px_20px_-8px_#10B981]',
        active && 'border-leaf/40 bg-leaf/12 text-leaf-fg',
        !highlight && !active && 'bg-background/50 hover:bg-muted',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function Metric({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl border bg-background/50 p-3.5', className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{children}</p>
    </div>
  )
}
