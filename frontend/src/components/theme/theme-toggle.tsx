import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTheme } from './theme-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Bouton soleil/lune : bascule entre thème sombre et clair (choix mémorisé dans le navigateur). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme !== 'light'
  const { t } = useTranslation()

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('relative overflow-hidden rounded-full', className)}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? t('theme.toLight') : t('theme.toDark')}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDark ? 'moon' : 'sun'}
          initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
          animate={{ rotate: 0, scale: 1, opacity: 1 }}
          exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex"
        >
          {isDark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  )
}
