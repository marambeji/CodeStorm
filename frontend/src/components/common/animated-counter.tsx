import { animate, useInView, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

/**
 * Compteur qui défile de 0 jusqu'à `value` quand il devient visible à l'écran.
 * On écrit directement dans le DOM (textContent) : aucun re-render React à chaque image.
 */
export function AnimatedCounter({
  value,
  decimals = 0,
  duration = 1.6,
  suffix = '',
  className,
}: {
  value: number
  decimals?: number
  duration?: number
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    const intl = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    // Espace fine (U+202F) absente de la police → espace insécable classique
    const format = { format: (n: number) => intl.format(n).replace(/\u202f/g, '\u00a0') }
    if (reduce) {
      el.textContent = format.format(value) + suffix
      return
    }
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = format.format(v) + suffix),
    })
    return () => controls.stop()
  }, [inView, value, decimals, duration, suffix, reduce])

  return (
    <span ref={ref} className={`tabular ${className ?? ''}`}>
      0{suffix}
    </span>
  )
}
