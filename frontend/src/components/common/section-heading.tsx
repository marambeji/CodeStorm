import type { ReactNode } from 'react'
import { RevealItem } from '@/components/fx/reveal'
import { cn } from '@/lib/utils'

const tones = {
  leaf: 'text-leaf-fg bg-leaf/10 ring-leaf/25 [--dot:#10B981]',
  water: 'text-water-fg bg-water/10 ring-water/25 [--dot:#0EA5E9]',
  energy: 'text-energy-fg bg-energy/10 ring-energy/25 [--dot:#F59E0B]',
  neutral: 'text-foreground/80 bg-foreground/[0.04] ring-border [--dot:var(--foreground)]',
}

/** Petit label coloré au-dessus d'un titre de section. */
export function SectionLabel({ tone = 'neutral', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', tones[tone])}>
      <span className="size-1.5 rounded-full bg-[var(--dot)]" aria-hidden="true" />
      {children}
    </span>
  )
}

/** Titre de section : label + grand titre + sous-titre, centré ou aligné à gauche. */
export function SectionHeading({
  label,
  tone,
  title,
  description,
  align = 'center',
  className,
}: {
  label: string
  tone?: keyof typeof tones
  title: ReactNode
  description?: string
  align?: 'center' | 'left'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-5', align === 'center' ? 'mx-auto max-w-2xl items-center text-center' : 'max-w-2xl', className)}>
      <RevealItem>
        <SectionLabel tone={tone}>{label}</SectionLabel>
      </RevealItem>
      <RevealItem>
        <h2 className="text-[2rem] leading-[1.08] font-extrabold tracking-[-0.035em] sm:text-5xl">{title}</h2>
      </RevealItem>
      {description && (
        <RevealItem>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
        </RevealItem>
      )}
    </div>
  )
}
