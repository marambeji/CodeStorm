import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export const STEPS = ['Dessiner', 'Choisir la culture', 'Estimation'] as const
export type StepIndex = 0 | 1 | 2

/**
 * Stepper visuel en haut de l'éditeur : 1. Dessiner → 2. Culture → 3. Estimation.
 * Les étapes pas encore accessibles sont désactivées (ex : pas de culture sans terrain).
 */
export function Stepper({ current, reachable, onStep, className }: { current: StepIndex; reachable: number; onStep: (s: StepIndex) => void; className?: string }) {
  return (
    <nav aria-label="Étapes" className={cn('glass flex items-center rounded-2xl border p-1 shadow-[var(--shadow-float)]', className)}>
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const active = i === current
          const done = i < current
          const disabled = i > reachable
          return (
            <li key={label} className="flex items-center">
              {i > 0 && <span className={cn('mx-0.5 h-px w-3 sm:w-5', i <= current ? 'bg-leaf' : 'bg-border')} aria-hidden="true" />}
              <button
                onClick={() => onStep(i as StepIndex)}
                disabled={disabled}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'relative flex h-9 items-center gap-2 rounded-xl px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 sm:px-3 sm:text-sm',
                  active ? 'text-foreground' : 'text-muted-foreground enabled:hover:text-foreground',
                )}
              >
                {active && <motion.span layoutId="tc-step" className="absolute inset-0 -z-10 rounded-xl bg-background shadow-sm ring-1 ring-border" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
                <span
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full text-[0.7rem] font-bold',
                    done ? 'bg-leaf text-[#0b1120]' : active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} aria-hidden="true" /> : i + 1}
                </span>
                {/* Sur mobile, seul le libellé de l'étape active est affiché */}
                <span className={cn(!active && 'hidden md:inline')}>{label}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
