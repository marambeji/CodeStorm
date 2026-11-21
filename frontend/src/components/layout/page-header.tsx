import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { ModuleIcon } from '@/components/common/module-icon'
import type { Tone } from '@/lib/modules'

/** En-tête de page : icône du module, grand titre, description et actions à droite. */
export function PageHeader({
  title,
  description,
  icon,
  tone,
  meta,
  actions,
}: {
  title: string
  description?: string
  icon?: LucideIcon
  tone?: Tone
  /** Petite information à côté de l'icône (ex : la thématique) */
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-4">
        {icon && tone && (
          <div className="flex items-center gap-3">
            <ModuleIcon icon={icon} tone={tone} size="lg" />
            {meta}
          </div>
        )}
        <h1 className="text-[2.25rem] leading-[1.05] font-extrabold tracking-[-0.04em] sm:text-5xl">{title}</h1>
        {description && <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
