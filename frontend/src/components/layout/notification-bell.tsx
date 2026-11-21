import { AlertOctagon, AlertTriangle, Bell, CheckCheck, Info } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDashboard, type AlertSeverity } from '@/features/dashboard/api'
import { MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils'

const KEY = 'notifications-read'
const STYLE: Record<AlertSeverity, { color: string; icon: typeof Info }> = {
  critique: { color: '#EF4444', icon: AlertOctagon },
  élevée: { color: '#F97316', icon: AlertTriangle },
  moyenne: { color: '#EAB308', icon: AlertTriangle },
  info: { color: '#0EA5E9', icon: Info },
}

function readIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

/**
 * Centre de notifications : les alertes calculées par le tableau de bord
 * (fuite, maladie, arrosage du jour, forte chaleur). L'état "lu" est gardé dans le navigateur.
 */
export function NotificationBell({ side = 'bottom', className }: { side?: 'bottom' | 'right'; className?: string }) {
  const { t } = useTranslation()
  const dash = useDashboard()
  const [read, setRead] = useState(readIds)
  const alerts = dash.data?.alerts ?? []
  const unread = alerts.filter((a) => !read.has(a.id)).length

  const save = useCallback((ids: Set<string>) => {
    setRead(new Set(ids))
    try {
      localStorage.setItem(KEY, JSON.stringify([...ids]))
    } catch {
      /* non bloquant */
    }
  }, [])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('relative rounded-full', className)} aria-label={t('notifications.open', { count: unread })}>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute top-1 end-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.6rem] leading-4 font-bold text-white ring-2 ring-background" aria-hidden="true">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side={side} align="end" className="w-[min(380px,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-semibold">{t('notifications.title')}</p>
          {unread > 0 && (
            <Button variant="ghost" size="xs" onClick={() => save(new Set(alerts.map((a) => a.id)))}>
              <CheckCheck aria-hidden="true" /> {t('notifications.markAll')}
            </Button>
          )}
        </div>
        <ul className="max-h-[22rem] overflow-y-auto p-1.5">
          {alerts.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">{t('notifications.empty')}</li>}
          {alerts.map((a) => {
            const s = STYLE[a.severity]
            const isUnread = !read.has(a.id)
            return (
              <li key={a.id}>
                <Link
                  to={a.link}
                  onClick={() => save(new Set([...read, a.id]))}
                  className={cn('flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted', isUnread && 'bg-muted/50')}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}1f`, color: s.color }}>
                    <s.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{a.title}</span>
                    <span className="block text-xs text-muted-foreground">{a.detail}</span>
                    <span className="mt-0.5 block text-[0.7rem] text-muted-foreground">{MODULES.find((m) => m.id === a.module)?.name}</span>
                  </span>
                  {isUnread && <span className="mt-2 size-2 shrink-0 rounded-full bg-water" aria-label="non lue" />}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/app">{t('notifications.seeDashboard')}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
