import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Aurora, GridBackdrop, Noise, Spotlight } from '@/components/fx/background-fx'
import { Button } from '@/components/ui/button'
import { DashboardMockup } from './dashboard-mockup'

const ease = [0.22, 1, 0.36, 1] as const

/** Hero de la landing : badge, titre, boutons et aperçu 3D du dashboard. */
export function Hero() {
  const mockupRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const reduce = useReducedMotion()

  // Le mockup est incliné au départ et se redresse pendant qu'on fait défiler la page
  const { scrollYProgress } = useScroll({ target: mockupRef, offset: ['start end', 'start 0.25'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [28, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.88, 1])
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [40, 0])

  return (
    <section className="relative isolate overflow-hidden pt-28 sm:pt-36">
      <Aurora />
      <GridBackdrop />
      <Noise />
      <Spotlight />

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 text-center sm:px-6">

        <motion.h1
          initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.1, ease }}
          className="mt-7 max-w-4xl text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.045em] sm:text-6xl lg:text-[5.25rem]"
        >
          {t('landing.title.before')}
          <span className="text-gradient-water">{t('landing.title.water')}</span>
          {t('landing.title.mid1')}
          <span className="text-gradient-energy">{t('landing.title.energy')}</span>
          {t('landing.title.mid2')}
          <span className="text-gradient-leaf">{t('landing.title.crops')}</span>
          {t('landing.title.after')}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease }}
          className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          {t('landing.subtitle')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease }}
          className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
        >
          <Button asChild size="lg" className="group h-12 px-6">
            <Link to="/app">
              {t('landing.start')}
              <ArrowRight className="transition-transform group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6">
            <a href="#apercu">
              <PlayCircle aria-hidden="true" /> {t('landing.demo')}
            </a>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-5 text-sm text-muted-foreground"
        >
          {t('landing.reassurance')}
        </motion.p>
      </div>

      {/* Aperçu 3D du dashboard */}
      <div id="apercu" className="relative mx-auto mt-16 max-w-6xl scroll-mt-24 px-3 pb-24 sm:mt-20 sm:px-6 [perspective:1400px]">
        {/* Halo coloré sous la maquette */}
        <div
          aria-hidden="true"
          className="absolute inset-x-[10%] top-[15%] -z-10 h-2/3 rounded-full bg-[conic-gradient(from_180deg,#10B981,#0EA5E9,#F59E0B,#10B981)] opacity-25 blur-[90px] dark:opacity-30"
        />
        <motion.div
          ref={mockupRef}
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease }}
        >
          <motion.div style={{ rotateX, scale, y, transformOrigin: 'center top' }} className="will-change-transform">
            <DashboardMockup />
          </motion.div>
        </motion.div>
        {/* Fondu bas */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background" />
      </div>
    </section>
  )
}
