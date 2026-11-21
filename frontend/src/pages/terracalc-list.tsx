import { FileDown, LandPlot, Plus, RefreshCw, ServerCrash, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { Reveal, RevealItem } from '@/components/fx/reveal'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage, useDeleteTerrain, useTerrains } from '@/features/terracalc/api'
import { MiniPolygon } from '@/features/terracalc/components/mini-polygon'
import { formatArea, formatKg, formatNumber } from '@/features/terracalc/geo'
import { downloadTerrainReport } from '@/features/terracalc/pdf'
import type { Terrain } from '@/features/terracalc/types'
import { MODULES } from '@/lib/modules'

const MODULE = MODULES.find((m) => m.id === 'terracalc')!

/** TerraCalc : page "Mes terrains" (liste + suppression + export PDF) */
export default function TerraCalcListPage() {
  const { t } = useTranslation()
  const terrains = useTerrains()

  return (
    <>
      <PageHeader
        title={MODULE.name}
        description={t('modules.terracalc.description')} icon={MODULE.icon}
        tone="leaf"
        meta={<Badge variant="outline">{t('themes.agriculture')}</Badge>}
        actions={
          <Button asChild size="lg" variant="module">
            <Link to="/app/terracalc/nouveau">
              <Plus aria-hidden="true" /> Nouveau terrain
            </Link>
          </Button>
        }
      />

      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-xl font-bold">Mes terrains</h2>
        {terrains.data && <span className="text-sm text-muted-foreground">{terrains.data.length} enregistré{terrains.data.length > 1 ? 's' : ''}</span>}
      </div>

      {terrains.isPending && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-3xl" />
          ))}
        </div>
      )}

      {terrains.isError && (
        <EmptyState
          icon={ServerCrash}
          title="Impossible de charger vos terrains"
          description={apiErrorMessage(terrains.error)}
          action={
            <Button variant="outline" onClick={() => terrains.refetch()}>
              <RefreshCw aria-hidden="true" /> Réessayer
            </Button>
          }
        />
      )}

      {terrains.data?.length === 0 && (
        <EmptyState
          icon={LandPlot}
          title="Aucun terrain pour l’instant"
          description="Dessinez votre premier terrain sur la carte : la surface, le nombre d’arbres et la production sont calculés en direct."
          action={
            <Button asChild variant="module">
              <Link to="/app/terracalc/nouveau">
                <Plus aria-hidden="true" /> Dessiner un terrain
              </Link>
            </Button>
          }
        />
      )}

      {terrains.data && terrains.data.length > 0 && (
        <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {terrains.data.map((t) => (
            <RevealItem key={t.id}>
              <TerrainCard terrain={t} />
            </RevealItem>
          ))}
        </Reveal>
      )}
    </>
  )
}

function TerrainCard({ terrain: t }: { terrain: Terrain }) {
  const del = useDeleteTerrain()
  const e = t.estimate

  async function exportPdf() {
    if (!e) return
    try {
      await downloadTerrainReport({ name: t.name, polygon: t.polygon, estimate: e })
      toast.success('Rapport PDF téléchargé')
    } catch {
      toast.error('Le PDF n’a pas pu être créé. Réessayez.')
    }
  }

  return (
    <SpotlightCard color="#10B981" className="flex h-full flex-col">
      <Link to={`/app/terracalc/${t.id}`} className="group flex flex-1 flex-col" aria-label={`Ouvrir ${t.name}`}>
        <div className="relative m-2 overflow-hidden rounded-2xl bg-muted/50">
          <MiniPolygon polygon={t.polygon} trees={Boolean(e?.trees)} className="h-36 w-full transition-transform duration-500 group-hover:scale-[1.04]" />
          {t.species && <Badge className="absolute top-3 left-3 bg-background/85 text-foreground backdrop-blur">{t.species.name}</Badge>}
        </div>
        <div className="flex flex-1 flex-col gap-4 px-5 pt-3 pb-2">
          <div>
            <h3 className="text-lg font-bold tracking-tight">{t.name}</h3>
            <p className="text-xs text-muted-foreground">
              {t.plantingYear ? `Planté en ${t.plantingYear}` : 'Plantation prévue'} · modifié le {new Date(t.updatedAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="Surface" value={formatArea(t.areaM2)} />
            <Stat label={e?.trees ? 'Arbres' : 'Culture'} value={e?.trees ? formatNumber(e.trees.count) : (t.species?.name ?? '—')} />
            <Stat label="Production" value={e ? `${formatKg(e.production.kgPerYear || e.production.kgPerYearFull)}/an` : '—'} />
          </dl>
        </div>
      </Link>
      <div className="flex items-center gap-1 border-t px-3 py-2">
        <Button asChild variant="ghost" size="sm" className="flex-1 justify-start">
          <Link to={`/app/terracalc/${t.id}`}>Ouvrir</Link>
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={exportPdf} disabled={!e} aria-label={`Télécharger le rapport PDF de ${t.name}`} title="Rapport PDF">
          <FileDown />
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Supprimer ${t.name}`} title="Supprimer">
              <Trash2 />
            </Button>
          }
          title={`Supprimer « ${t.name} » ?`}
          description="Le contour et l’estimation de ce terrain seront définitivement supprimés."
          onConfirm={async () => {
            try {
              await del.mutateAsync(t.id)
              toast.success('Terrain supprimé')
            } catch (err) {
              toast.error(apiErrorMessage(err))
            }
          }}
        />
      </div>
    </SpotlightCard>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/50 px-2.5 py-2">
      <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
      <dd className="tabular truncate font-bold">{value}</dd>
    </div>
  )
}
