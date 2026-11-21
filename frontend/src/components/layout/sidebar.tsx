import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Logo, LogoMark } from '@/components/brand/logo'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { StatusPill } from '@/components/common/status-pill'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SIDEBAR_WIDTH, useSidebar } from '@/hooks/use-sidebar'
import { cn } from '@/lib/utils'
import { NavLinks } from './nav-links'
import { UserMenu } from './user-menu'
import { NotificationBell } from './notification-bell'
import { openPalette } from '@/lib/events'

/** Sidebar fixe et repliable, visible uniquement sur grand écran (≥ 1024px). */
export function Sidebar() {
  const { collapsed, toggle } = useSidebar()

  return (
    <aside
      style={{ width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded }}
      className="glass fixed inset-y-0 start-0 z-30 hidden flex-col border-e py-4 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:flex"
    >
      <div className={cn('mb-7 flex h-10 items-center', collapsed ? 'justify-center px-2' : 'justify-between ps-5 pe-2')}>
        {collapsed ? (
          <Link to="/" aria-label="EcoNexus, accueil" className="rounded-lg">
            <LogoMark />
          </Link>
        ) : (
          <Logo to="/" />
        )}
        {!collapsed && <CollapseButton collapsed={collapsed} onClick={toggle} />}
      </div>

      <SearchRow collapsed={collapsed} />
      <div className={cn('flex-1 overflow-x-hidden overflow-y-auto', collapsed ? 'px-3' : 'px-3')}>
        <NavLinks layoutId="nav-active-desktop" collapsed={collapsed} />
      </div>

      <div className="px-3">
        {collapsed && (
          <div className="mb-2 flex justify-center">
            <CollapseButton collapsed={collapsed} onClick={toggle} />
          </div>
        )}
        <SidebarFooter collapsed={collapsed} />
      </div>
    </aside>
  )
}

/** Recherche (palette Ctrl+K) + centre de notifications */
function SearchRow({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation()
  if (collapsed)
    return (
      <div className="mb-4 flex flex-col items-center gap-1 px-3">
        <Button variant="ghost" size="icon" onClick={openPalette} aria-label={`${t('search.button')} (Ctrl K)`}>
          <Search className="size-[18px]" />
        </Button>
        <NotificationBell side="right" />
      </div>
    )
  return (
    <div className="mb-5 flex items-center gap-1 px-3">
      <button
        onClick={openPalette}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border bg-background/40 px-3 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 truncate text-start">{t('search.button')}</span>
        <kbd className="rounded border px-1.5 text-[0.65rem]">Ctrl K</kbd>
      </button>
      <NotificationBell side="right" />
    </div>
  )
}

function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const { t } = useTranslation()
  const label = collapsed ? t('nav.expand') : t('nav.collapse')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} className="text-muted-foreground">
          {collapsed ? <PanelLeftOpen className="rtl:-scale-x-100" /> : <PanelLeftClose className="rtl:-scale-x-100" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Bas de la navigation : état de l'API, thème et compte utilisateur. */
export function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <div className={cn('flex items-center gap-1', collapsed ? 'flex-col' : 'justify-between ps-1')}>
        <StatusPill compact={collapsed} />
        <div className={cn('flex items-center', collapsed && 'flex-col')}>
          <LanguageSwitcher side={collapsed ? 'right' : 'top'} />
          <ThemeToggle />
        </div>
      </div>
      <UserMenu collapsed={collapsed} />
    </div>
  )
}
