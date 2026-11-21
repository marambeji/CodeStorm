import { ChevronsUpDown, Home, Palette, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/**
 * Avatar + menu utilisateur en bas de la sidebar.
 * Pour l'instant : utilisateur invité (l'authentification JWT arrive avec les nouvelles fonctionnalités).
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent',
          collapsed && 'justify-center',
        )}
        aria-label={t('user.account')}
      >
        <Avatar />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{t('user.guest')}</span>
              <span className="block truncate text-xs text-muted-foreground">{t('user.demo')}</span>
            </span>
            <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={collapsed ? 'right' : 'top'} align={collapsed ? 'end' : 'start'} className="w-56">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar />
          <span>
            <span className="block text-sm font-semibold">{t('user.guest')}</span>
            <span className="block text-xs font-normal text-muted-foreground">{t('user.soon')}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound /> {t('user.profile')}
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/kit">
            <Palette /> {t('user.kit')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/">
            <Home /> {t('user.backToSite')}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Avatar à initiales, bordé du dégradé des trois thématiques. */
function Avatar() {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_200deg,#10B981,#0EA5E9,#F59E0B,#10B981)] p-[2px]">
      <span className="flex size-full items-center justify-center rounded-full bg-background text-xs font-bold">IN</span>
    </span>
  )
}
