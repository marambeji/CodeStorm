import type { CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import { Noise } from '@/components/fx/background-fx'
import { useModuleAccent } from '@/hooks/use-module-accent'
import { SIDEBAR_WIDTH, SidebarProvider, useSidebar } from '@/hooks/use-sidebar'
import { moduleFromPath } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { AmbientGlow } from './ambient-glow'
import { MobileTopbar } from './mobile-topbar'
import { PageTransition } from './page-transition'
import { Sidebar } from './sidebar'
import { SkipLink } from './skip-link'

/**
 * Coquille de l'application (/app/...) :
 * - desktop (≥ 1024px) : sidebar fixe et repliable à gauche
 * - mobile / tablette : barre du haut + menu hamburger
 * La couleur du module courant pilote la lumière ambiante et les accents.
 */
export function AppLayout() {
  return (
    <SidebarProvider>
      <Shell />
    </SidebarProvider>
  )
}

function Shell() {
  const { pathname } = useLocation()
  const mod = moduleFromPath(pathname)
  const { collapsed } = useSidebar()
  useModuleAccent(mod?.tone)
  // Pages "plein écran" (carte TerraCalc) : pas de marges, toute la hauteur disponible
  const fullBleed = /^\/app\/(terracalc\/.+|hydromap)/.test(pathname)

  return (
    <div
      className="min-h-svh"
      style={{ '--sbw': `${collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded}px` } as CSSProperties}
    >
      <SkipLink />
      <Sidebar />
      <div className="relative isolate min-h-svh transition-[padding] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:ps-[var(--sbw)]">
        <MobileTopbar />
        <AmbientGlow tone={mod?.tone} />
        <Noise className="fixed" />
        <main
          id="contenu"
          tabIndex={-1}
          className={cn(
            'outline-none',
            fullBleed ? 'h-[calc(100svh-4rem)] w-full lg:h-svh' : 'mx-auto w-full max-w-6xl px-4 pt-8 pb-20 sm:px-6 lg:px-10 lg:pt-12',
          )}
        >
          <PageTransition className={fullBleed ? 'h-full' : undefined} />
        </main>
      </div>
    </div>
  )
}
