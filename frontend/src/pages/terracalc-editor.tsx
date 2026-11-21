import { AnimatePresence, motion } from 'framer-motion'
import type L from 'leaflet'
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage, useEstimate, useSaveTerrain, useSpecies, useTerrain } from '@/features/terracalc/api'
import { CompareDivider, LayerSwitcher, Timeline } from '@/features/terracalc/components/map-controls'
import { LocationSearch } from '@/features/terracalc/components/location-search'
import { ResponsivePanel } from '@/features/terracalc/components/responsive-panel'
import { SaveDialog } from '@/features/terracalc/components/save-dialog'
import { StepCrop } from '@/features/terracalc/components/step-crop'
import { StepDraw } from '@/features/terracalc/components/step-draw'
import { StepReport } from '@/features/terracalc/components/step-report'
import { Stepper, type StepIndex } from '@/features/terracalc/components/stepper'
import { TerraMap, type FlyTarget, type LayerState } from '@/features/terracalc/components/terra-map'
import { fromPolygon, isValidShape, measure, toPolygon } from '@/features/terracalc/geo'
import type { CropConfig, LatLng } from '@/features/terracalc/types'
import { useDrawing } from '@/features/terracalc/use-drawing'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const CURRENT_YEAR = new Date().getFullYear()
const DEFAULT_CONFIG: CropConfig = {
  speciesId: '',
  plantingYear: CURRENT_YEAR - 5,
  rowSpacingM: null,
  treeSpacingM: null,
  irrigation: 'goutte-a-goutte',
  pricePerKg: null,
}
const PANEL_TITLES = [
  { title: 'Délimitez votre terrain', sub: 'Placez les coins du terrain sur la carte.' },
  { title: 'Choisissez la culture', sub: 'Espèce, âge, espacement et irrigation.' },
  { title: 'Estimation', sub: 'Calculs du moteur TerraCalc, expliqués par l’IA.' },
]

/** TerraCalc : éditeur plein écran (1. Dessiner → 2. Culture → 3. Estimation) */
export default function TerraCalcEditorPage() {
  const { id } = useParams()
  const terrain = useTerrain(id)

  if (id && terrain.isPending) return <EditorSkeleton />
  if (id && terrain.isError)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">{apiErrorMessage(terrain.error)}</p>
        <Button asChild variant="outline">
          <Link to="/app/terracalc">Retour à mes terrains</Link>
        </Button>
      </div>
    )
  return <Editor key={id ?? 'nouveau'} terrainId={id} initial={terrain.data} />
}

function Editor({ terrainId, initial }: { terrainId?: string; initial?: ReturnType<typeof useTerrain>['data'] }) {
  const navigate = useNavigate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const species = useSpecies()
  const save = useSaveTerrain()

  const initialPoints = useMemo(() => (initial ? fromPolygon(initial.polygon) : []), [initial])
  const drawing = useDrawing(initialPoints)
  const [step, setStep] = useState<StepIndex>(initial?.speciesId ? 2 : 0)
  const [config, setConfig] = useState<CropConfig>(
    initial?.speciesId
      ? {
          speciesId: initial.speciesId,
          plantingYear: initial.plantingYear,
          rowSpacingM: initial.rowSpacingM,
          treeSpacingM: initial.treeSpacingM,
          irrigation: initial.irrigation ?? 'goutte-a-goutte',
          pricePerKg: initial.pricePerKg,
        }
      : DEFAULT_CONFIG,
  )
  const [layers, setLayers] = useState<LayerState>({ base: 'satellite', year: 2025, compare: false, compareYears: [2016, 2025], divider: 0.5 })
  const [flyTo, setFlyTo] = useState<FlyTarget | null>(null)
  const [userPosition, setUserPosition] = useState<LatLng | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const mapRef = useRef<L.Map | null>(null)

  const measures = useMemo(() => measure(drawing.points), [drawing.points])
  const valid = isValidShape(measures)
  const polygon = useMemo(() => (valid ? toPolygon(drawing.points) : null), [valid, drawing.points])
  const estimate = useEstimate(step >= 1 ? polygon : null, config.speciesId ? config : null)
  const reachable = !valid ? 0 : config.speciesId ? 2 : 1

  // Si le terrain devient invalide (points supprimés…), on revient au dessin
  useEffect(() => {
    if (step > reachable) setStep(reachable as StepIndex)
  }, [reachable, step])

  const initialBounds = useMemo(() => {
    if (!initialPoints.length) return undefined
    const lats = initialPoints.map((p) => p[0])
    const lngs = initialPoints.map((p) => p[1])
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ] as [LatLng, LatLng]
  }, [initialPoints])

  const trees = step >= 1 && config.speciesId ? (estimate.data?.trees?.points ?? []) : []

  function handleSave(name: string) {
    if (!polygon) return
    save.mutate(
      { id: terrainId, name, polygon, ...config },
      {
        onSuccess: (t) => {
          setSaveOpen(false)
          toast.success(terrainId ? 'Terrain mis à jour' : 'Terrain enregistré', { description: `${t.name} est dans « Mes terrains ».` })
          if (!terrainId) navigate(`/app/terracalc/${t.id}`, { replace: true })
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  async function handlePdf() {
    if (!polygon || !estimate.data) return
    try {
      const { downloadTerrainReport } = await import('@/features/terracalc/pdf')
      await downloadTerrainReport({ name: initial?.name ?? 'Nouveau terrain', polygon, estimate: estimate.data })
      toast.success('Rapport PDF téléchargé')
    } catch {
      toast.error('Le PDF n’a pas pu être créé. Réessayez.')
    }
  }

  // Mise à jour des calques ; en activant la comparaison sur desktop, le séparateur se place
  // au centre de la zone de carte visible (le panneau couvre la droite de la carte)
  function updateLayers(patch: Partial<LayerState>) {
    setLayers((l) => {
      const next = { ...l, ...patch }
      const map = mapRef.current?.getContainer()
      if (patch.compare && desktop && map) {
        const panel = (step === 2 ? Math.min(560, map.clientWidth - 32) : 400) + 32
        next.divider = (map.clientWidth - panel) / 2 / map.clientWidth
      }
      return next
    })
  }

  const panelWidth = step === 2 ? 'lg:right-[calc(min(560px,100%-2rem)+2rem)]' : 'lg:right-[calc(400px+2rem)]'
  const historique = layers.base === 'historique'

  return (
    <div className="relative isolate size-full overflow-hidden">
      <div className="absolute inset-0">
        <TerraMap
          mapRef={mapRef}
          points={drawing.points}
          mode={drawing.mode}
          selected={drawing.selected}
          trees={trees}
          layers={layers}
          flyTo={flyTo}
          userPosition={userPosition}
          locked={step > 0}
          initialBounds={initialBounds}
          onAdd={drawing.add}
          onMoveStart={drawing.moveStart}
          onMove={drawing.move}
          onInsert={drawing.insert}
          onSelect={drawing.select}
          onClose={() => drawing.setMode('edit')}
        />
        {historique && layers.compare && (
          <CompareDivider value={layers.divider} years={layers.compareYears} onChange={(divider) => setLayers((l) => ({ ...l, divider }))} />
        )}
      </div>

      {/* Haut : retour, étapes, recherche */}
      <div className={cn('pointer-events-none absolute top-3 right-3 left-3 z-[600] flex flex-col gap-2 sm:top-4 sm:left-4', panelWidth)}>
        <div className="flex items-center gap-2 [&>*]:pointer-events-auto">
          <Button asChild variant="outline" size="icon" className="glass size-11 shrink-0 rounded-xl shadow-[var(--shadow-float)]">
            <Link to="/app/terracalc" aria-label="Retour à mes terrains">
              <ArrowLeft />
            </Link>
          </Button>
          <Stepper current={step} reachable={reachable} onStep={setStep} className="min-w-0" />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start [&>*]:pointer-events-auto">
          {step === 0 && (
            <LocationSearch
              className="w-full sm:max-w-sm"
              onPlace={(bounds) => setFlyTo({ key: Date.now(), bounds })}
              onLocate={(p) => {
                setUserPosition(p)
                setFlyTo({ key: Date.now(), center: p, zoom: 17 })
              }}
            />
          )}
          {!desktop && <LayerSwitcher value={layers.base} onChange={(base) => setLayers((l) => ({ ...l, base }))} className="self-end sm:ml-auto" />}
        </div>
        {!desktop && (
          <AnimatePresence>{historique && <Timeline key="tl" layers={layers} onChange={updateLayers} className="pointer-events-auto" />}</AnimatePresence>
        )}
      </div>

      {/* Bas gauche (desktop) : frise temporelle + fonds de carte + zoom */}
      {desktop && (
        <div className="absolute bottom-4 left-4 z-[600] flex w-[380px] flex-col items-start gap-3">
          <AnimatePresence>{historique && <Timeline key="tl" layers={layers} onChange={updateLayers} />}</AnimatePresence>
          <LayerSwitcher
            value={layers.base}
            onChange={(base) => setLayers((l) => ({ ...l, base }))}
            onZoom={(d) => (d > 0 ? mapRef.current?.zoomIn() : mapRef.current?.zoomOut())}
          />
        </div>
      )}

      <ResponsivePanel
        desktop={desktop}
        wide={step === 2}
        snapKey={step}
        header={
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              <p className="text-xs font-semibold text-leaf-fg">Étape {step + 1} sur 3</p>
              <h2 className="text-xl font-extrabold tracking-tight">{PANEL_TITLES[step].title}</h2>
              <p className="text-sm text-muted-foreground">{initial?.name && step === 2 ? initial.name : PANEL_TITLES[step].sub}</p>
            </motion.div>
          </AnimatePresence>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
            {step === 0 && <StepDraw drawing={drawing} measures={measures} onNext={() => setStep(1)} />}
            {step === 1 && (
              <StepCrop
                species={species.data}
                loading={species.isPending}
                config={config}
                onChange={(c) => setConfig((prev) => ({ ...prev, ...c }))}
                estimate={estimate.data}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <StepReport
                polygon={polygon}
                estimate={estimate.data}
                loading={estimate.isFetching}
                error={estimate.isError ? apiErrorMessage(estimate.error) : null}
                price={config.pricePerKg}
                onPrice={(pricePerKg) => setConfig((c) => ({ ...c, pricePerKg }))}
                onSave={() => setSaveOpen(true)}
                onPdf={handlePdf}
                saving={save.isPending}
                saved={Boolean(terrainId)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </ResponsivePanel>

      <SaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultName={initial?.name ?? ''}
        existing={Boolean(terrainId)}
        saving={save.isPending}
        onSave={handleSave}
      />
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="relative size-full" aria-busy="true" aria-label="Chargement du terrain">
      <Skeleton className="absolute inset-0 rounded-none" />
      <Skeleton className="absolute top-4 right-4 bottom-4 hidden w-[400px] rounded-3xl lg:block" />
    </div>
  )
}
