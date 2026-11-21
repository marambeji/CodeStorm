import { motion, useMotionValueEvent, useScroll } from 'framer-motion'
import { Menu } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet } from 'react-router-dom'
import { Logo } from '@/components/brand/logo'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useModuleAccent } from '@/hooks/use-module-accent'
import { cn } from '@/lib/utils'
import { SkipLink } from './skip-link'

const LINKS = [
  { href: '#modules', key: 'nav.modulesLink' },
]

/** Layout de la vitrine (landing page) : barre de navigation flottante. */
export function MarketingLayout() {
  useModuleAccent(undefined)
  return (
    <div className="relative isolate min-h-svh overflow-x-clip">
      <SkipLink />
      <MarketingNavbar />
      <main id="contenu" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
    </div>
  )
}

function MarketingNavbar() {
  // En haut de page : barre transparente pleine largeur.
  // Dès qu'on défile : elle se resserre en "pilule" de verre dépoli.
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))
  const { t, i18n } = useTranslation()

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          'mx-auto flex h-14 items-center gap-6 rounded-2xl border px-3 transition-[max-width,background-color,border-color,box-shadow] duration-500 ease-out sm:px-4',
          scrolled ? 'glass max-w-4xl border-border shadow-[var(--shadow-float)]' : 'max-w-6xl border-transparent',
        )}
      >
        <Logo />
        <nav aria-label={t('nav.sections')} className="hidden items-center gap-0.5 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
            >
              {t(l.key)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button asChild size="sm" className="hidden h-9 px-4 sm:inline-flex">
            <Link to="/app">{t('nav.openApp')}</Link>
          </Button>

          {/* Menu hamburger (mobile uniquement) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.openMenu')}>
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={i18n.dir() === 'rtl' ? 'left' : 'right'} className="w-[86%] max-w-xs gap-0 px-4 py-5">
              <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
              <SheetDescription className="sr-only">{t('nav.sections')}</SheetDescription>
              <Logo className="mb-8 px-2" />
              <nav aria-label={t('nav.sections')} className="flex flex-col gap-1">
                {LINKS.map((l) => (
                  <SheetClose asChild key={l.href}>
                    <a href={l.href} className="flex min-h-12 items-center rounded-xl px-3 text-base font-medium hover:bg-muted">
                      {t(l.key)}
                    </a>
                  </SheetClose>
                ))}
              </nav>
              <Button asChild size="lg" className="mt-auto w-full">
                <Link to="/app">{t('nav.openAppLong')}</Link>
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </motion.div>
    </header>
  )
}
