import { Menu, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Logo } from '@/components/brand/logo'
import { LanguageSwitcher } from '@/components/common/language-switcher'
import { ThemeToggle } from '@/components/theme/theme-toggle'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { NavLinks } from './nav-links'
import { NotificationBell } from './notification-bell'
import { openPalette } from '@/lib/events'
import { SidebarFooter } from './sidebar'

/** Barre du haut sur mobile et tablette (< 1024px) avec menu hamburger. */
export function MobileTopbar() {
  const [open, setOpen] = useState(false)
  const { t, i18n } = useTranslation()

  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-3 sm:px-5 lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t('nav.openMenu')}>
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side={i18n.dir() === 'rtl' ? 'right' : 'left'} className="w-[86%] max-w-xs gap-0 px-3 py-5">
          <SheetTitle className="sr-only">{t('nav.menu')}</SheetTitle>
          <SheetDescription className="sr-only">{t('nav.main')}</SheetDescription>
          <Logo to="/" className="mb-8 px-3" />
          <div className="flex-1 overflow-y-auto">
            {/* On ferme le tiroir dès qu'on choisit une page */}
            <NavLinks layoutId="nav-active-mobile" onNavigate={() => setOpen(false)} />
          </div>
          <SidebarFooter />
        </SheetContent>
      </Sheet>
      <Logo to="/" />
      <div className="ms-auto flex items-center">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={openPalette} aria-label={t('search.button')}>
          <Search className="size-[18px]" />
        </Button>
        <NotificationBell />
        <LanguageSwitcher />
        <ThemeToggle />
      </div>
    </header>
  )
}
