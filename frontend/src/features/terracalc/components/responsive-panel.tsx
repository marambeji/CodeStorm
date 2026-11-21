import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from 'framer-motion'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Panneau latéral (desktop) ou "bottom sheet" (mobile/tablette).
 *
 * Bottom sheet : 3 positions (aperçu, moitié, plein). On le fait glisser par sa poignée ;
 * le contenu, lui, défile normalement. Un clic sur la poignée passe à la position suivante.
 */
export function ResponsivePanel({
  desktop,
  wide,
  children,
  header,
  snapKey,
}: {
  desktop: boolean
  /** Panneau plus large (étape Estimation) */
  wide?: boolean
  header?: ReactNode
  children: ReactNode
  /** Change de valeur → le bottom sheet s'ouvre à mi-hauteur (ex : changement d'étape) */
  snapKey?: unknown
}) {
  if (desktop) {
    return (
      <DesktopPanel wide={wide} header={header} snapKey={snapKey}>
        {children}
      </DesktopPanel>
    )
  }
  return (
    <BottomSheet header={header} snapKey={snapKey}>
      {children}
    </BottomSheet>
  )
}

function DesktopPanel({ wide, header, children, snapKey }: { wide?: boolean; header?: ReactNode; children: ReactNode; snapKey?: unknown }) {
  const scrollRef = useScrollTopOn(snapKey)
  return (
      <motion.aside
        layout
        transition={{ type: 'spring', stiffness: 260, damping: 32 }}
        className={cn(
          'glass absolute top-4 right-4 bottom-4 z-[500] flex flex-col overflow-hidden rounded-3xl border shadow-[var(--shadow-float)]',
          wide ? 'w-[min(560px,calc(100%-2rem))]' : 'w-[400px]',
        )}
      >
        {header && <div className="border-b px-6 pt-5 pb-4">{header}</div>}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </motion.aside>
  )
}

/** Remet le contenu défilant en haut quand `key` change (nouvelle étape) */
function useScrollTopOn(key: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 })
  }, [key])
  return ref
}

const PEEK = 210 // hauteur visible en position "aperçu" (px)

function BottomSheet({ header, children, snapKey }: { header?: ReactNode; children: ReactNode; snapKey?: unknown }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const y = useMotionValue(10_000)
  const controls = useDragControls()
  const reduce = useReducedMotion()
  const [snap, setSnap] = useState<0 | 1 | 2>(0)
  const scrollRef = useScrollTopOn(snapKey)

  // Mesure la hauteur disponible (parent) pour calculer les positions
  useLayoutEffect(() => {
    const parent = containerRef.current?.parentElement
    if (!parent) return
    const ro = new ResizeObserver(() => setHeight(parent.clientHeight))
    ro.observe(parent)
    setHeight(parent.clientHeight)
    return () => ro.disconnect()
  }, [])

  const sheetHeight = Math.max(height - 72, PEEK)
  const positions = [sheetHeight - PEEK, sheetHeight * 0.45, 0]

  useEffect(() => {
    if (!height) return
    animate(y, positions[snap], reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 34 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap, height])

  // Nouvelle étape : on ouvre à mi-hauteur pour montrer le contenu.
  // On compare à la valeur précédente (et non à un drapeau "premier rendu", que le
  // double appel des effets de React en développement rendrait faux).
  const previousKey = useRef(snapKey)
  useEffect(() => {
    if (previousKey.current === snapKey) return
    previousKey.current = snapKey
    setSnap((s) => (s === 0 ? 1 : s))
  }, [snapKey])

  function onDragEnd(_: unknown, info: { velocity: { y: number } }) {
    const current = y.get()
    const projected = current + info.velocity.y * 0.2
    const nearest = positions.reduce((best, p, i) => (Math.abs(p - projected) < Math.abs(positions[best] - projected) ? i : best), 0)
    if (nearest === snap) animate(y, positions[snap], { type: 'spring', stiffness: 300, damping: 34 })
    setSnap(nearest as 0 | 1 | 2)
  }

  return (
    <motion.div
      ref={containerRef}
      role="region"
      aria-label="Panneau TerraCalc"
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: positions[0] }}
      dragElastic={0.08}
      onDragEnd={onDragEnd}
      style={{ y, height: sheetHeight }}
      className="glass absolute inset-x-0 bottom-0 z-[650] flex flex-col rounded-t-3xl border-t shadow-[0_-12px_40px_-12px_rgb(0_0_0/0.35)]"
    >
      <button
        onPointerDown={(e) => controls.start(e)}
        onClick={() => setSnap((s) => ((s + 1) % 3) as 0 | 1 | 2)}
        className="flex h-7 w-full shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
        aria-label={snap === 2 ? 'Réduire le panneau' : 'Agrandir le panneau'}
      >
        <span className="h-1.5 w-11 rounded-full bg-foreground/25" />
      </button>
      {header && (
        <div className="touch-none px-5 pb-3" onPointerDown={(e) => controls.start(e)}>
          {header}
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </motion.div>
  )
}
