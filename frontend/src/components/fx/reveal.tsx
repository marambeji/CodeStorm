import { motion, type Variants } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Apparition au scroll avec effet "stagger" (les enfants apparaissent l'un après l'autre).
 * Usage :
 *   <Reveal stagger> <RevealItem>…</RevealItem> <RevealItem>…</RevealItem> </Reveal>
 * Respecte "réduire les animations" via <MotionConfig reducedMotion="user"> (main.tsx).
 */
const container: Variants = {
  hidden: {},
  show: (stagger: number) => ({ transition: { staggerChildren: stagger } }),
}

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
}

export function Reveal({
  children,
  className,
  stagger = 0.08,
  as = 'div',
}: {
  children: ReactNode
  className?: string
  stagger?: number
  as?: 'div' | 'ul' | 'section'
}) {
  const Comp = motion[as]
  return (
    <Comp
      className={className}
      variants={container}
      custom={stagger}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
    >
      {children}
    </Comp>
  )
}

export function RevealItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const Comp = motion[as]
  return (
    <Comp className={className} variants={revealItem}>
      {children}
    </Comp>
  )
}
