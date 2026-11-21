import { Check, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LANGS } from '@/i18n/locales'
import { cn } from '@/lib/utils'

/** Sélecteur de langue (FR / EN / عربي) */
export function LanguageSwitcher({ className, side = 'bottom' }: { className?: string; side?: 'top' | 'bottom' | 'right' }) {
  const { t, i18n } = useTranslation()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('rounded-full', className)} aria-label={`${t('lang.label')} : ${t(`lang.${i18n.language}`)}`}>
          <Languages className="size-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" className="w-44">
        <DropdownMenuLabel>{t('lang.label')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LANGS.map((l) => (
          <DropdownMenuItem key={l} onSelect={() => i18n.changeLanguage(l)} lang={l} className="justify-between">
            {t(`lang.${l}`)}
            {i18n.language === l && <Check className="size-4" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
