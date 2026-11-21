import { ChevronsUpDown, Home, LogOut, UserRound } from 'lucide-react'
import { useState } from 'react'
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
import { useAuthActions } from '@/features/auth/auth'
import { initials, useProfile } from '@/features/profile/api'
import { ProfileDialog } from '@/features/profile/profile-dialog'
import { cn } from '@/lib/utils'

/** Avatar + menu utilisateur en bas de la sidebar (profil enregistré en base). */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { t } = useTranslation()
  const profile = useProfile()
  const [editing, setEditing] = useState(false)
  const auth = useAuthActions()
  const p = profile.data
  const name = p?.name ?? 'Mon exploitation'
  const sub = p?.farmName ?? p?.placeName ?? p?.email ?? ''

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent',
            collapsed && 'justify-center',
          )}
          aria-label={t('user.account')}
        >
          <Avatar text={initials(p?.name)} />
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{name}</span>
                <span className="block truncate text-xs text-muted-foreground">{sub}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden="true" />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent side={collapsed ? 'right' : 'top'} align={collapsed ? 'end' : 'start'} className="w-60">
          <DropdownMenuLabel className="flex items-center gap-3 py-2">
            <Avatar text={initials(p?.name)} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{p?.email}</span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <UserRound /> {p?.placeName ? 'Modifier mon profil' : 'Compléter mon profil (lieu)'}
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/">
              <Home /> {t('user.backToSite')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => auth.logout()} className="text-destructive focus:text-destructive">
            <LogOut /> Se déconnecter
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog open={editing} onOpenChange={setEditing} />
    </>
  )
}

/** Avatar à initiales, bordé du dégradé des trois thématiques. */
function Avatar({ text }: { text: string }) {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_200deg,#10B981,#0EA5E9,#F59E0B,#10B981)] p-[2px]">
      <span className="flex size-full items-center justify-center rounded-full bg-background text-xs font-bold">{text}</span>
    </span>
  )
}
