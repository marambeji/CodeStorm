import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Effets de fond, empilables (tous décoratifs, donc aria-hidden).
 * Les animations sont en CSS pur (transform uniquement) : fluides même sur mobile,
 * et automatiquement coupées avec "réduire les animations".
 */

/** Aurore : trois nappes de couleur floues qui dérivent lentement (vert / bleu / ambre). */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      <div className="absolute inset-0" style={{ opacity: 'var(--aurora-opacity)' }}>
        <div className="animate-aurora-1 absolute -top-[30%] left-[-10%] h-[70%] w-[55%] rounded-full bg-[#10B981] blur-[90px]" />
        <div className="animate-aurora-2 absolute -top-[40%] left-[25%] h-[75%] w-[50%] rounded-full bg-[#0EA5E9] blur-[100px]" />
        <div className="animate-aurora-3 absolute -top-[30%] right-[-12%] h-[65%] w-[48%] rounded-full bg-[#F59E0B] blur-[100px] opacity-80" />
      </div>
      {/* Fondu vers le fond de page */}
      <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-b from-transparent to-background" />
    </div>
  )
}

/** Grille fine qui défile très lentement, estompée sur les bords. */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid-lines animate-grid-pan pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_70%_55%_at_50%_0%,#000_40%,transparent_100%)]',
        className,
      )}
    />
  )
}

/** Grain photographique par-dessus tout le fond. */
export function Noise({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('noise pointer-events-none absolute inset-0 -z-10 mix-blend-overlay', className)}
      style={{ opacity: 'var(--noise-opacity)' }}
    />
  )
}

/**
 * Spotlight : un halo doux qui suit la souris dans le conteneur parent.
 * On écrit des variables CSS directement (pas de state React) → aucun re-render.
 * Désactivé sur écran tactile (pas de souris à suivre).
 */
export function Spotlight({ size = 640 }: { size?: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent || !window.matchMedia('(pointer: fine)').matches) return
    let frame = 0
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const r = parent.getBoundingClientRect()
        el.style.setProperty('--mx', `${e.clientX - r.left}px`)
        el.style.setProperty('--my', `${e.clientY - r.top}px`)
        el.style.opacity = '1'
      })
    }
    const onLeave = () => (el.style.opacity = '0')
    parent.addEventListener('pointermove', onMove)
    parent.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      parent.removeEventListener('pointermove', onMove)
      parent.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-500"
      style={{ background: `radial-gradient(${size}px circle at var(--mx, 50%) var(--my, 0%), var(--spotlight), transparent 45%)` }}
    />
  )
}
