import type { LucideIcon } from 'lucide-react'
import { toneClasses, type Tone } from '@/lib/modules'
import { cn } from '@/lib/utils'

const sizes = {
  sm: 'size-8 rounded-lg [&_svg]:size-4',
  md: 'size-10 rounded-xl [&_svg]:size-5',
  lg: 'size-12 rounded-2xl [&_svg]:size-6',
}

/** Pastille d'icône teintée de la couleur du module (vert / bleu / ambre). */
export function ModuleIcon({
  icon: Icon,
  tone,
  size = 'md',
  className,
}: {
  icon: LucideIcon
  tone: Tone
  size?: keyof typeof sizes
  className?: string
}) {
  const t = toneClasses[tone]
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center ring-1 ring-inset', t.soft, t.text, t.ring, sizes[size], className)}
    >
      <Icon aria-hidden="true" />
    </span>
  )
}
