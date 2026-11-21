import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'

/**
 * Nombre qui glisse en douceur de son ancienne valeur vers la nouvelle
 * (contrairement à AnimatedCounter qui part de 0 une seule fois).
 * Idéal pour les mesures qui changent en direct (surface pendant le dessin…).
 */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    const from = previous.current
    previous.current = value
    if (!el || from === value) return
    if (reduce) {
      el.textContent = format(value)
      return
    }
    const controls = animate(from, value, {
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = format(v)),
    })
    return () => controls.stop()
  }, [value, format, reduce])

  return (
    <span ref={ref} className={`tabular ${className ?? ''}`}>
      {format(value)}
    </span>
  )
}
