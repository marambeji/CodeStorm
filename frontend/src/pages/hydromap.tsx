import { AnimatePresence, motion } from 'framer-motion'
import type L from 'leaflet'
import { ArrowLeft, CloudRain, Droplets, Layers, Loader2, Minus, PencilLine, Plus, Sparkles, Sprout, Trash2, TrendingDown, TrendingUp, Waves } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { toast } from 'sonner'
import { AnimatedNumber } from '@/components/common/animated-number'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useDeleteObservation, useForecast, useObservations, useOverview, useSaveObservation, useZones, useZoneSummary } from '@/features/hydromap/api'
import { HydroMap } from '@/features/hydromap/hydro-map'
import { LEVEL_STYLE, OBSERVATION_LABEL, SCALES, type Indicator, type Observation, type ObservationType, type StressLevel, type ZoneProps } from '@/features/hydromap/types'
import { ListenButton } from '@/features/plantdoc/components'
import { apiErrorMessage } from '@/features/terracalc/api'
import { ResponsivePanel } from '@/features/terracalc/components/responsive-panel'
import { formatNumber } from '@/features/terracalc/geo'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

const WATER = '#0EA5E9'
const pct = (n: number) => `${Math.round(n * 100)} %`
const INDICATORS: { id: Indicator; label: string }[] = [
  { id: 'stress', label: 'Stress hydrique' },
  { id: 'ndvi', label: 'NDVI' },
  { id: 'ndwi', label: 'NDWI' },
]

/** HydroMap : stress hydrique par zone, prévisions, synthèse pour décideurs, observations */
export default function HydroMapPage() {
  const zones = useZones()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [indicator, setIndicator] = useState<Indicator>('stress')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const mapRef = useRef<L.Map | null>(null)
  const selected = zones.data?.features.find((f) => f.properties.id === selectedId)?.properties ?? null

  if (zones.isPending) return <Skeleton className="size-full rounded-none" />
  if (zones.isError)
    return <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">{apiErrorMessage(zones.error)}</div>

  return (
    <div className="relative isolate size-full overflow-hidden">
      <div className="absolute inset-0">
        <HydroMap zones={zones.data} indicator={indicator} selectedId={selectedId} onSelect={setSelectedId} mapRef={mapRef} />
      </div>

      {/* Haut gauche : titre + choix de l'indicateur */}
      <div className={cn('pointer-events-none absolute top-3 left-3 z-[600] flex flex-col gap-2 sm:top-4 sm:left-4', desktop ? (selected ? 'right-[calc(min(560px,100%-2rem)+2rem)]' : 'right-[calc(400px+2rem)]') : 'right-3')}>
        <div className="glass pointer-events-auto flex w-fit items-center gap-3 rounded-2xl border px-4 py-2.5 shadow-[var(--shadow-float)]">
          <span className="flex size-8 items-center justify-center rounded-lg bg-water/15 text-water-fg">
            <Droplets className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-sm leading-tight font-extrabold">HydroMap</h1>
            <p className="text-[0.7rem] text-muted-foreground">{zones.data.source}</p>
          </div>
        </div>
        <div role="radiogroup" aria-label="Indicateur affiché" className="glass pointer-events-auto flex w-fit rounded-xl border p-1 shadow-[var(--shadow-float)]">
          {INDICATORS.map((i) => (
            <button
              key={i.id}
              role="radio"
              aria-checked={indicator === i.id}
              onClick={() => setIndicator(i.id)}
              className={cn('relative h-9 rounded-lg px-3 text-xs font-semibold transition-colors', indicator === i.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {indicator === i.id && <motion.span layoutId="hydro-ind" className="absolute inset-0 -z-10 rounded-lg bg-background shadow-sm ring-1 ring-border" />}
              {i.label}
            </button>
          ))}
        </div>
      </div>

      {/* Légende (desktop : en bas à gauche ; mobile : sous l'indicateur) */}
      <Legend indicator={indicator} className={desktop ? 'absolute bottom-4 left-4 z-[600]' : 'absolute top-[7.6rem] left-3 z-[600]'} />
      {desktop && (
        <div className="glass absolute right-[calc(400px+2rem)] bottom-4 z-[600] flex flex-col overflow-hidden rounded-xl border shadow-[var(--shadow-float)]" style={selected ? { right: 'calc(min(560px, 100% - 2rem) + 2rem)' } : undefined}>
          <button onClick={() => mapRef.current?.zoomIn()} className="flex size-9 items-center justify-center hover:bg-muted" aria-label="Zoomer">
            <Plus className="size-4" />
          </button>
          <button onClick={() => mapRef.current?.zoomOut()} className="flex size-9 items-center justify-center border-t hover:bg-muted" aria-label="Dézoomer">
            <Minus className="size-4" />
          </button>
        </div>
      )}

      <ResponsivePanel
        desktop={desktop}
        wide={Boolean(selected)}
        snapKey={selectedId}
        header={
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={selected?.id ?? 'overview'} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
              {selected ? (
                <div className="flex items-start gap-3">
                  <Button variant="ghost" size="icon-sm" onClick={() => setSelectedId(null)} aria-label="Retour à la vue d’ensemble" className="-ml-2 shrink-0">
                    <ArrowLeft />
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-water-fg">{selected.landUse}</p>
                    <h2 className="truncate text-xl font-extrabold tracking-tight">{selected.name}</h2>
                    <LevelBadge level={selected.level} value={selected.stress} />
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-water-fg">Vue d’ensemble</p>
                  <h2 className="text-xl font-extrabold tracking-tight">Stress hydrique du territoire</h2>
                  <p className="text-sm text-muted-foreground">Touchez une zone pour voir son détail.</p>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={selected?.id ?? 'overview'} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.22 }}>
            {selected ? <ZoneDetail zone={selected} /> : <OverviewPanel zones={zones.data.features.map((f) => f.properties)} onSelect={setSelectedId} />}
          </motion.div>
        </AnimatePresence>
      </ResponsivePanel>
    </div>
  )
}

function Legend({ indicator, className }: { indicator: Indicator; className?: string }) {
  const items =
    indicator === 'stress'
      ? (Object.entries(LEVEL_STYLE) as [StressLevel, { color: string; label: string }][]).map(([, s]) => ({ color: s.color, label: s.label }))
      : SCALES[indicator].colors.map((color, i) => ({ color, label: SCALES[indicator].labels[i] }))
  const title = indicator === 'stress' ? 'Stress hydrique' : SCALES[indicator].title
  return (
    <div className={cn('glass rounded-xl border px-3 py-2.5 shadow-[var(--shadow-float)]', className)}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[0.7rem] font-semibold">
        <Layers className="size-3.5" aria-hidden="true" /> {title}
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 sm:flex-col">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
            <span className="size-2.5 rounded-[3px] ring-1 ring-black/10" style={{ backgroundColor: it.color }} aria-hidden="true" />
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

function LevelBadge({ level, value }: { level: StressLevel; value?: number }) {
  const s = LEVEL_STYLE[level]
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset" style={{ backgroundColor: `${s.color}1f`, color: s.color, boxShadow: `inset 0 0 0 1px ${s.color}40` }}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
      Stress {s.label.toLowerCase()}
      {value !== undefined && ` · ${pct(value)}`}
    </span>
  )
}

// ─────────────────────────── Vue d'ensemble ───────────────────────────

function OverviewPanel({ zones, onSelect }: { zones: ZoneProps[]; onSelect: (id: string) => void }) {
  const overview = useOverview()
  const ranked = [...zones].sort((a, b) => b.stress - a.stress)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-2">
        {(Object.keys(LEVEL_STYLE) as StressLevel[]).map((l) => (
          <div key={l} className="rounded-2xl border bg-background/50 p-3 text-center">
            <p className="tabular text-2xl font-extrabold" style={{ color: LEVEL_STYLE[l].color }}>
              {overview.data ? <AnimatedNumber value={overview.data.counts[l]} format={(n) => String(Math.round(n))} /> : '–'}
            </p>
            <p className="text-[0.7rem] text-muted-foreground">{LEVEL_STYLE[l].label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2 rounded-2xl border bg-background/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-energy-fg" aria-hidden="true" /> Synthèse pour les décideurs
          </h3>
          {overview.data && <ListenButton text={overview.data.ai.summary} />}
        </div>
        {overview.data ? <p className="text-sm leading-relaxed">{overview.data.ai.summary}</p> : <Skeleton className="h-16" />}
        {overview.data && (
          <p className="text-xs text-muted-foreground">
            {zones.length} zones · {formatNumber(overview.data.totalAreaHa)} ha · stress moyen {pct(overview.data.averageStress)}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Zones par niveau de stress</h3>
        <ul className="space-y-1">
          {ranked.map((z) => (
            <li key={z.id}>
              <button onClick={() => onSelect(z.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: LEVEL_STYLE[z.level].color }} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{z.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {z.landUse} · {LEVEL_STYLE[z.level].label}
                  </span>
                </span>
                <span className="w-24">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: pct(z.stress), backgroundColor: LEVEL_STYLE[z.level].color }} />
                  </span>
                </span>
                <span className="tabular w-10 text-right text-sm font-bold">{pct(z.stress)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ─────────────────────────── Fiche d'une zone ───────────────────────────

function ZoneDetail({ zone: z }: { zone: ZoneProps }) {
  const forecast = useForecast(z.id)
  const summary = useZoneSummary(z.id)
  const f = forecast.data
  const in30 = f?.forecast.at(-1)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Metric icon={<Sprout />} label="NDVI" value={z.ndvi.toFixed(2)} sub={z.ndvi > 0.5 ? 'végétation vigoureuse' : z.ndvi > 0.3 ? 'végétation moyenne' : 'végétation clairsemée'} />
        <Metric icon={<Droplets />} label="NDWI" value={z.ndwi.toFixed(2)} sub={z.ndwi > 0.1 ? 'bien hydraté' : z.ndwi > -0.05 ? 'hydratation moyenne' : 'sec'} />
        <Metric icon={<CloudRain />} label="Pluie (90 j)" value={`${z.rainfallAnomaly > 0 ? '+' : ''}${z.rainfallAnomaly} %`} sub="vs normale" />
        <Metric icon={<Waves />} label="Nappe" value={`${z.groundwaterTrend > 0 ? '+' : ''}${formatNumber(z.groundwaterTrend, 1)} m`} sub="par an" />
      </div>

      {/* Prévision */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">Stress hydrique : 30 derniers jours et prévision à 30 jours</h3>
          {f && in30 && (
            <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', f.trend === 'hausse' ? 'text-red-600 dark:text-red-400' : f.trend === 'baisse' ? 'text-leaf-fg' : 'text-muted-foreground')}>
              {f.trend === 'hausse' ? <TrendingUp className="size-3.5" aria-hidden="true" /> : f.trend === 'baisse' ? <TrendingDown className="size-3.5" aria-hidden="true" /> : null}
              {pct(in30.stress)} dans 30 j ({f.trend})
            </span>
          )}
        </div>
        {f ? <ForecastChart forecast={f} /> : <Skeleton className="h-52 rounded-2xl" />}
      </section>

      {/* Synthèse IA */}
      <section className="space-y-3 rounded-2xl border bg-background/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-energy-fg" aria-hidden="true" /> Synthèse pour les décideurs
          </h3>
          {summary.data && <ListenButton text={`${summary.data.summary} Actions recommandées : ${summary.data.actions.join(' ')}`} />}
        </div>
        {summary.data ? (
          <>
            <p className="text-sm leading-relaxed">{summary.data.summary}</p>
            <div>
              <p className="mb-1.5 text-xs font-semibold">Actions recommandées</p>
              <ol className="space-y-1.5">
                {summary.data.actions.map((a, i) => (
                  <li key={a} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-water/15 text-[0.7rem] font-bold text-water-fg">{i + 1}</span>
                    {a}
                  </li>
                ))}
              </ol>
            </div>
          </>
        ) : (
          <Skeleton className="h-24" />
        )}
      </section>

      <Observations zoneId={z.id} />
    </div>
  )
}

function Metric({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border bg-background/50 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-water-fg">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1 text-lg font-extrabold">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{sub}</p>
    </div>
  )
}

function ForecastChart({ forecast }: { forecast: NonNullable<ReturnType<typeof useForecast>['data']> }) {
  const today = forecast.history.at(-1)!.date
  const data = [
    ...forecast.history.map((p) => ({ date: p.date, observed: p.stress })),
    // Le premier point de prévision repart du dernier point observé (pas de trou)
    ...forecast.forecast.map((p, i) => ({ date: p.date, predicted: p.stress, band: [p.low, p.high] as [number, number], ...(i === 0 ? {} : {}) })),
  ]
  data[forecast.history.length - 1] = { ...data[forecast.history.length - 1], predicted: forecast.history.at(-1)!.stress } as (typeof data)[number]
  const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

  return (
    <figure className="space-y-2">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="date" tickFormatter={short} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} minTickGap={40} />
            <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => `${v * 100}`} tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} unit="%" />
            <Tooltip content={<ForecastTooltip />} />
            <ReferenceLine x={today} stroke="var(--muted-foreground)" strokeDasharray="2 3" label={{ value: 'Aujourd’hui', position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 10 }} />
            <Area dataKey="band" stroke="none" fill={WATER} fillOpacity={0.15} isAnimationActive={false} />
            <Line dataKey="observed" stroke={WATER} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="predicted" stroke={WATER} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ backgroundColor: WATER }} aria-hidden="true" /> Observé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded border-t-2 border-dashed" style={{ borderColor: WATER }} aria-hidden="true" /> Prévision
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: `${WATER}26` }} aria-hidden="true" /> Incertitude (80 %)
        </span>
      </figcaption>
    </figure>
  )
}

function ForecastTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as { date: string; observed?: number; predicted?: number; band?: [number, number] }
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-float)]">
      <p className="font-semibold">{new Date(`${d.date}T00:00:00Z`).toLocaleDateString('fr-FR', { dateStyle: 'medium', timeZone: 'UTC' })}</p>
      {d.observed !== undefined && <p className="tabular">Observé : {pct(d.observed)}</p>}
      {d.observed === undefined && d.predicted !== undefined && <p className="tabular">Prévu : {pct(d.predicted)}</p>}
      {d.band && (
        <p className="tabular text-muted-foreground">
          entre {pct(d.band[0])} et {pct(d.band[1])}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────── Observations (CRUD) ───────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

function Observations({ zoneId }: { zoneId: string }) {
  const list = useObservations(zoneId)
  const save = useSaveObservation()
  const del = useDeleteObservation()
  const [editing, setEditing] = useState<Observation | 'new' | null>(null)

  return (
    <section className="space-y-3" aria-labelledby="obs-title">
      <div className="flex items-center justify-between">
        <h3 id="obs-title" className="text-sm font-semibold">
          Observations de terrain
        </h3>
        {editing === null && (
          <Button size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus aria-hidden="true" /> Ajouter
          </Button>
        )}
      </div>

      <AnimatePresence>
        {editing !== null && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <ObservationForm
              initial={editing === 'new' ? null : editing}
              pending={save.isPending}
              onCancel={() => setEditing(null)}
              onSubmit={async (input) => {
                try {
                  await save.mutateAsync({ ...input, zoneId, id: editing === 'new' ? undefined : editing.id })
                  toast.success(editing === 'new' ? 'Observation ajoutée' : 'Observation modifiée')
                  setEditing(null)
                } catch (e) {
                  toast.error(apiErrorMessage(e))
                }
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {list.isPending && <Skeleton className="h-20 rounded-xl" />}
      {list.data?.length === 0 && editing === null && (
        <p className="rounded-xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
          Aucune observation. Ajoutez un relevé de puits ou une remarque de terrain pour compléter les données satellite.
        </p>
      )}
      <ul className="space-y-2">
        {list.data?.map((o) => (
          <li key={o.id} className="flex gap-3 rounded-xl border bg-background/50 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-water-fg">
                {OBSERVATION_LABEL[o.type]} · {new Date(o.observedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                {o.waterLevelM !== null && ` · eau à ${formatNumber(o.waterLevelM, 1)} m`}
              </p>
              <p className="mt-0.5 text-sm">{o.note}</p>
            </div>
            <div className="flex shrink-0 gap-0.5">
              <Button variant="ghost" size="icon-sm" onClick={() => setEditing(o)} aria-label="Modifier l’observation">
                <PencilLine />
              </Button>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label="Supprimer l’observation">
                    <Trash2 />
                  </Button>
                }
                title="Supprimer cette observation ?"
                description={`« ${o.note.slice(0, 80)} » sera définitivement supprimée.`}
                onConfirm={async () => {
                  try {
                    await del.mutateAsync(o.id)
                    toast.success('Observation supprimée')
                  } catch (e) {
                    toast.error(apiErrorMessage(e))
                  }
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ObservationForm({
  initial,
  pending,
  onCancel,
  onSubmit,
}: {
  initial: Observation | null
  pending: boolean
  onCancel: () => void
  onSubmit: (v: { type: ObservationType; note: string; waterLevelM: number | null; observedAt: string }) => void
}) {
  const [type, setType] = useState<ObservationType>(initial?.type ?? 'puits')
  const [note, setNote] = useState(initial?.note ?? '')
  const [level, setLevel] = useState(initial?.waterLevelM != null ? String(initial.waterLevelM) : '')
  const [date, setDate] = useState(initial ? initial.observedAt.slice(0, 10) : today())
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => setSubmitted(false), [initial])

  const levelNum = level.trim() === '' ? null : Number(level.replace(',', '.'))
  const errors = {
    note: note.trim().length < 3 ? 'Décrivez l’observation en quelques mots (3 caractères minimum).' : null,
    level: levelNum !== null && (Number.isNaN(levelNum) || levelNum < 0 || levelNum > 500) ? 'Profondeur entre 0 et 500 m.' : null,
    date: !date ? 'Indiquez la date.' : date > today() ? 'La date ne peut pas être dans le futur.' : null,
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (errors.note || errors.level || errors.date) return
    onSubmit({ type, note: note.trim(), waterLevelM: levelNum, observedAt: new Date(`${date}T12:00:00`).toISOString() })
  }

  const err = (k: keyof typeof errors) => submitted && errors[k] && <p className="text-xs text-destructive">{errors[k]}</p>

  return (
    <form onSubmit={submit} noValidate className="space-y-3 rounded-2xl border bg-background/60 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="obs-type">Type</Label>
          <select id="obs-type" value={type} onChange={(e) => setType(e.target.value as ObservationType)} className="h-10 w-full rounded-lg border bg-transparent px-2.5 text-sm dark:bg-input/30">
            {Object.entries(OBSERVATION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obs-date">Date</Label>
          <input id="obs-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-full rounded-lg border bg-transparent px-2.5 text-sm dark:bg-input/30" />
          {err('date')}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="obs-level">Profondeur de l’eau (m)</Label>
          <input id="obs-level" inputMode="decimal" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="facultatif" className="h-10 w-full rounded-lg border bg-transparent px-2.5 text-sm dark:bg-input/30" />
          {err('level')}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="obs-note">Observation</Label>
        <textarea id="obs-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : puits du village à sec depuis lundi." className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm dark:bg-input/30" />
        {err('note')}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" size="sm" variant="module" disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {initial ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </div>
    </form>
  )
}
