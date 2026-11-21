import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { ModuleIcon } from '@/components/common/module-icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DASHBOARD, MODULES, toneHex } from '@/lib/modules'
import { cn } from '@/lib/utils'

/**
 * Liens de navigation de l'application, partagés entre la sidebar (desktop)
 * et le tiroir (mobile). L'indicateur actif "glisse" d'un lien à l'autre grâce à `layoutId`.
 * En mode replié, seules les icônes restent visibles (le nom s'affiche en infobulle).
 */
export function NavLinks({
  onNavigate,
  layoutId,
  collapsed = false,
}: {
  onNavigate?: () => void
  layoutId: string
  collapsed?: boolean
}) {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-6">
      <ul>
        <li>
          <NavItem
            to={DASHBOARD.path}
            label={t('nav.overview')}
            active={pathname === DASHBOARD.path}
            onNavigate={onNavigate}
            layoutId={layoutId}
            collapsed={collapsed}
            icon={
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.06] ring-1 ring-inset ring-border">
                <DASHBOARD.icon className="size-4" aria-hidden="true" />
              </span>
            }
          />
        </li>
      </ul>

      <div>
        {collapsed ? (
          <div className="mx-auto mb-3 h-px w-6 bg-border" aria-hidden="true" />
        ) : (
          <p className="px-3 pb-2 text-xs font-medium text-muted-foreground">{t('nav.modules')}</p>
        )}
        <ul className="flex flex-col gap-0.5">
          {MODULES.map((m) => (
            <li key={m.id}>
              <NavItem
                to={m.path}
                label={m.name}
                active={pathname.startsWith(m.path)}
                onNavigate={onNavigate}
                layoutId={layoutId}
                accent={toneHex[m.tone]}
                collapsed={collapsed}
                icon={<ModuleIcon icon={m.icon} tone={m.tone} size="sm" />}
                meta={t(`themes.${m.theme}`)}
              />
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

function NavItem({
  to,
  label,
  icon,
  meta,
  active,
  accent,
  layoutId,
  collapsed,
  onNavigate,
}: {
  to: string
  label: string
  icon: ReactNode
  meta?: string
  active: boolean
  accent?: string
  layoutId: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const link = (
    <Link
      to={to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        'relative isolate flex min-h-11 items-center gap-3 rounded-xl py-1.5 text-sm font-medium transition-colors',
        collapsed ? 'justify-center px-0' : 'px-3',
        active ? 'text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 -z-10 rounded-xl bg-sidebar-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] ring-1 ring-inset ring-border"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        >
          {/* Trait de couleur du module, à gauche du lien actif */}
          <span
            className="absolute start-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full"
            style={{ backgroundColor: accent ?? 'var(--foreground)', boxShadow: `0 0 12px ${accent ?? 'transparent'}` }}
          />
        </motion.span>
      )}
      {icon}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {meta && <span className="text-xs font-normal text-muted-foreground">{meta}</span>}
        </>
      )}
    </Link>
  )

  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
