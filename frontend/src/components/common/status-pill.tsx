import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useApiHealth } from '@/hooks/use-api-health'
import { cn } from '@/lib/utils'

/**
 * Indique si le backend répond et si l'IA est réelle ou simulée.
 * `compact` : seulement le point coloré, le texte passe en infobulle (sidebar repliée).
 */
export function StatusPill({ className, compact = false }: { className?: string; compact?: boolean }) {
  const health = useApiHealth()
  const { t } = useTranslation()

  const { dot, label } =
    health.state === 'checking'
      ? { dot: 'bg-muted-foreground animate-pulse', label: t('status.checking') }
      : health.state === 'offline'
        ? { dot: 'bg-energy', label: t('status.offline') }
        : health.aiMode === 'llm'
          ? { dot: 'bg-leaf', label: t('status.llm') }
          : { dot: 'bg-leaf', label: t('status.mock') }

  const pulse = (
    <span className="relative flex size-2" aria-hidden="true">
      {health.state === 'online' && <span className={cn('absolute inset-0 animate-ping rounded-full opacity-60', dot)} />}
      <span className={cn('relative size-2 rounded-full', dot)} />
    </span>
  )

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span role="status" aria-label={label} tabIndex={0} className="flex size-9 items-center justify-center rounded-lg">
            {pulse}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div role="status" className={cn('flex items-center gap-2 rounded-full bg-muted/70 px-3 py-1.5 text-xs font-medium text-muted-foreground', className)}>
      {pulse}
      {label}
    </div>
  )
}
