import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, useEffect } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { PageSkeleton } from './page-skeleton'

/**
 * Affiche la page courante avec une transition douce (fondu + léger glissement).
 * `useOutlet()` "fige" l'ancienne page pendant son animation de sortie.
 */
export function PageTransition({ className }: { className?: string }) {
  const location = useLocation()
  const outlet = useOutlet()

  // Retour en haut de page à chaque navigation
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className={className}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <Suspense fallback={<PageSkeleton />}>{outlet}</Suspense>
      </motion.div>
    </AnimatePresence>
  )
}
