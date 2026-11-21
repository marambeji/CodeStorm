import { Hero } from '@/components/landing/hero'
import { ModulesBento } from '@/components/landing/modules-bento'

/**
 * Landing page.
 * Étape 2 : hero + bento des modules.
 * Étape 3 : statistiques d'impact, "Comment ça marche", "Pourquoi sans IoT", footer.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ModulesBento />
    </>
  )
}
