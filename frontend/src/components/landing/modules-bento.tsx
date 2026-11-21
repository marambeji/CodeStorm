import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ModuleIcon } from '@/components/common/module-icon'
import { SectionHeading } from '@/components/common/section-heading'
import { Reveal, RevealItem } from '@/components/fx/reveal'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { MODULES, toneHex, type ModuleDef } from '@/lib/modules'
import { cn } from '@/lib/utils'
import { BillBarsPreview, LeafScanPreview, MeterScanPreview, MiniMapPreview, TerrainDrawPreview } from './bento-previews'

/**
 * Bento grid des 5 modules (cartes de tailles différentes).
 * Desktop :  [ PlantDoc (large) ][ FactureIA (haute) ]
 *            [ HydroMap ][ AquaScan ][     ...        ]
 *            [ TerraCalc (pleine largeur, horizontale)  ]
 * L'ordre visuel est fixé avec `order` (l'ordre du tableau MODULES reste celui de la navigation).
 */
const LAYOUT: Record<ModuleDef['id'], { className: string; preview: ReactNode; detail: string; horizontal?: boolean }> = {
  plantdoc: {
    className: 'sm:col-span-2 lg:col-span-2 lg:order-1',
    preview: <LeafScanPreview />,
    detail: 'Prenez une feuille en photo : maladie, niveau de confiance, gravité et traitement expliqué simplement, à lire ou à écouter.',
  },
  terracalc: {
    className: 'sm:col-span-2 lg:col-span-3 lg:order-5',
    preview: <TerrainDrawPreview />,
    detail:
      'Dessinez votre terrain sur l’image satellite : surface au m² près, nombre d’arbres possibles, eau, production et revenu sur 10 ans, avec l’évolution du terrain depuis 2016.',
    horizontal: true,
  },
  factureia: {
    className: 'lg:row-span-2 lg:order-2',
    preview: <BillBarsPreview />,
    detail: 'Déposez votre facture PDF : consommation, tranches et montant décryptés, puis simulez vos économies.',
  },
  hydromap: {
    className: 'lg:order-3',
    preview: <MiniMapPreview />,
    detail: 'Le stress hydrique de chaque zone, calculé à partir d’images satellite.',
  },
  aquascan: {
    className: 'sm:col-span-2 lg:col-span-1 lg:order-4',
    preview: <MeterScanPreview />,
    detail: 'Photographiez votre compteur : la valeur est lue automatiquement et les fuites signalées.',
  },
}

export function ModulesBento() {
  const { t } = useTranslation()
  return (
    <section id="modules" className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-6 sm:py-32">
      <Reveal>
        <SectionHeading
          label={t('landing.modulesLabel')}
          tone="leaf"
          title={t('landing.modulesTitle')}
          description={t('landing.modulesSubtitle')}
        />
      </Reveal>

      <Reveal className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:grid-rows-[auto_auto]" stagger={0.1}>
        {MODULES.map((m) => (
          <RevealItem key={m.id} className={cn('min-w-0', LAYOUT[m.id].className)}>
            <BentoCard module={m} detail={t(`modules.${m.id}.detail`)} preview={LAYOUT[m.id].preview} tall={m.id === 'factureia'} horizontal={LAYOUT[m.id].horizontal} />
          </RevealItem>
        ))}
      </Reveal>
    </section>
  )
}

function BentoCard({
  module: m,
  detail,
  preview,
  tall,
  horizontal,
}: {
  module: ModuleDef
  detail: string
  preview: ReactNode
  tall?: boolean
  horizontal?: boolean
}) {
  const { t } = useTranslation()
  if (horizontal) {
    // Carte large : texte à gauche, aperçu à droite (empilés sur mobile)
    return (
      <SpotlightCard color={toneHex[m.tone]} className="h-full">
        <Link to={m.path} className="group grid h-full items-center gap-6 p-6 sm:p-7 lg:grid-cols-[1fr_1.3fr] lg:gap-10">
          <div className="flex flex-col gap-6">
            <CardTitle module={m} />
            <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">{detail}</p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-leaf-fg">
              {t('landing.newModule')} <span className="size-1.5 rounded-full bg-leaf" aria-hidden="true" /> {t('landing.newModuleDetail')}
            </span>
          </div>
          {preview}
        </Link>
      </SpotlightCard>
    )
  }
  return (
    <SpotlightCard color={toneHex[m.tone]} className="h-full">
      <Link to={m.path} className="group flex h-full flex-col gap-6 p-6 sm:p-7">
        <CardTitle module={m} />
        <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">{detail}</p>
        <div className={cn('mt-auto', tall && 'lg:flex-1')}>{preview}</div>
      </Link>
    </SpotlightCard>
  )
}

function CardTitle({ module: m }: { module: ModuleDef }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <ModuleIcon icon={m.icon} tone={m.tone} />
        <div>
          <h3 className="text-lg font-bold tracking-tight">{m.name}</h3>
          <p className="text-xs font-medium text-muted-foreground">{t(`themes.${m.theme}`)}</p>
        </div>
      </div>
      <span className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-all duration-300 group-hover:border-transparent group-hover:bg-foreground group-hover:text-background">
        <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:rotate-45 rtl:-scale-x-100" aria-hidden="true" />
        <span className="sr-only">{t('landing.open')} {m.name}</span>
      </span>
    </div>
  )
}
