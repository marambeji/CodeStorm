import { useRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Carte dont la bordure s'illumine sous le curseur (effet "Linear").
 * Deux couches suivent la souris :
 *  1. un anneau de 1px (masque CSS qui ne garde que la bordure)
 *  2. une lueur très douce à l'intérieur
 * Sur tactile, la carte reste simplement une belle carte.
 */
export function SpotlightCard({
  color = '#0EA5E9',
  className,
  children,
}: {
  color?: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  function onPointerMove(e: React.PointerEvent) {
    const el = ref.current
    if (!el || e.pointerType !== 'mouse') return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--x', `${e.clientX - r.left}px`)
    el.style.setProperty('--y', `${e.clientY - r.top}px`)
  }

  return (
    <div
      ref={ref}
      onPointerMove={onPointerMove}
      style={{ '--spot': color } as CSSProperties}
      className={cn(
        'group/spot edge-light relative isolate overflow-hidden rounded-3xl border bg-card backdrop-blur-sm transition-colors duration-300',
        className,
      )}
    >
      {/* 1. Bordure lumineuse */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] p-px opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: 'radial-gradient(260px circle at var(--x, 50%) var(--y, 50%), var(--spot), transparent 65%)',
          mask: 'linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)',
          WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
        }}
      />
      {/* 2. Lueur intérieure */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), color-mix(in srgb, var(--spot) 11%, transparent), transparent 60%)',
        }}
      />
      {children}
    </div>
  )
}
