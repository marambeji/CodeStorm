import { motion } from 'framer-motion'
import { Bot, CalendarCheck, CheckCircle2, CloudRain, Droplets, Flame, Leaf, Loader2, Plus, RefreshCw, Send, Snowflake, Sparkles, Trash2, Zap } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { SYSTEM_LABEL, useAskPlan, useCreatePlan, useDeletePlan, usePlans, useRefreshPlan, useSetDay, type IrrigationSystem, type SavedPlan } from '@/features/irriplan/api'
import { ListenButton } from '@/features/plantdoc/components'
import { useProfile } from '@/features/profile/api'
import { LocationField, type PickedPlace } from '@/features/profile/location-field'
import { apiErrorMessage, useSpecies, useTerrains } from '@/features/terracalc/api'
import { formatNumber } from '@/features/terracalc/geo'
import { MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils'

const MODULE = MODULES.find((m) => m.id === 'irriplan')!
const WATER = '#0EA5E9'
const RAIN = '#64748B'
const today = () => new Date().toISOString().slice(0, 10)
const dayLabel = (iso: string, lang: string, long = false) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(lang === 'ar' ? 'ar' : lang, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric' })

/** IrriPlan : planning d'irrigation 7 jours (FAO-56 + météo réelle), expliqué par l'IA */
export default function IrriPlanPage() {
  const { t } = useTranslation()
  const plans = usePlans()
  const [planId, setPlanId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const current = plans.data?.find((p) => p.id === planId) ?? plans.data?.[0] ?? null

  return (
    <>
      <PageHeader
        title={MODULE.name}
        description={t('modules.irriplan.description')}
        icon={MODULE.icon}
        tone="water"
        meta={
          <>
            <Badge variant="outline">{t('themes.eau')}</Badge>
            <Badge variant="outline">{t('themes.energie')}</Badge>
            <Badge variant="outline">{t('themes.agriculture')}</Badge>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Plans" className="flex flex-wrap gap-2">
          {plans.data?.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === current?.id}
              onClick={() => setPlanId(p.id)}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                p.id === current?.id ? 'border-water/50 bg-water/12 text-water-fg' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {p.name}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setCreating(true)}>
          <Plus aria-hidden="true" /> Nouveau plan
        </Button>
      </div>

      {plans.isLoading ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-3xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      ) : !current ? (
        <EmptyState
          icon={Droplets}
          title="Aucun plan d’irrigation"
          description="Choisissez un terrain TerraCalc (ou saisissez votre parcelle) : IrriPlan calcule quand arroser et combien, avec la météo des 7 prochains jours."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> Créer mon premier plan
            </Button>
          }
        />
      ) : (
        <PlanView key={current.id} plan={current} onDeleted={() => setPlanId(null)} />
      )}

      <NewPlanDialog open={creating} onOpenChange={setCreating} onCreated={(id) => setPlanId(id)} />
    </>
  )
}

// ─────────────────────────────── Vue d'un plan ───────────────────────────────

function PlanView({ plan: p, onDeleted }: { plan: SavedPlan; onDeleted: () => void }) {
  const { i18n } = useTranslation()
  const refresh = useRefreshPlan()
  const del = useDeletePlan()
  const r = p.plan
  const t0 = today()
  const stale = r.days[0]?.date < t0

  // La météo change : on recalcule automatiquement un plan dont la semaine a commencé avant aujourd'hui
  useEffect(() => {
    if (stale && !refresh.isPending) refresh.mutate(p.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, stale])

  const next = r.days.find((d) => d.irrigate && d.date >= t0 && !p.doneDays.includes(d.date))

  return (
    <div className="space-y-5">
      {/* Bandeau : prochain arrosage */}
      <SpotlightCard className="overflow-hidden rounded-3xl border bg-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-medium text-water-fg">{next ? 'Prochain arrosage' : 'Cette semaine'}</p>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {next ? (
                <>
                  {dayLabel(next.date, i18n.language, true)} : {formatNumber(next.volumeM3, 1)} m³
                </>
              ) : (
                'Aucun arrosage nécessaire'
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              {next
                ? [next.litersPerTree ? `${formatNumber(next.litersPerTree)} L par arbre` : null, next.durationH ? `environ ${formatNumber(next.durationH, 1)} h d’irrigation` : null, 'tôt le matin'].filter(Boolean).join(', ')
                : 'Le sol garde assez d’eau grâce à la pluie et à la météo douce.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refresh.mutate(p.id, { onSuccess: () => toast.success('Plan recalculé avec la météo du jour'), onError: (e) => toast.error(apiErrorMessage(e)) })} disabled={refresh.isPending}>
              {refresh.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />} Mettre à jour la météo
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="ghost" size="icon" aria-label="Supprimer ce plan">
                  <Trash2 aria-hidden="true" />
                </Button>
              }
              title={`Supprimer « ${p.name} » ?`}
              description="Le plan et son suivi seront définitivement supprimés."
              onConfirm={async () => {
                await del.mutateAsync(p.id)
                toast.success('Plan supprimé')
                onDeleted()
              }}
            />
          </div>
        </div>
        <p className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            {r.species.name} · {formatNumber(p.areaM2 / 10_000, 2)} ha{p.trees ? ` · ${formatNumber(p.trees)} arbres` : ''} · {SYSTEM_LABEL[p.irrigation as IrrigationSystem]}
          </span>
          <span className={cn(r.weatherSource === 'open-meteo' ? 'text-leaf-fg' : 'text-energy-fg')}>
            {r.weatherSource === 'open-meteo' ? '● Météo réelle (Open-Meteo)' : '● Météo estimée (hors connexion)'}
          </span>
        </p>
      </SpotlightCard>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Droplets />} tone="water" label="Eau cette semaine" value={`${formatNumber(r.totals.volumeM3, 1)} m³`} hint={`${r.totals.irrigationDays} arrosage(s)`} />
        <Kpi icon={<Leaf />} tone="leaf" label="Eau économisée" value={`${formatNumber(r.comparison.savedM3, 1)} m³`} hint={`${r.comparison.savedPct} % vs arrosage d’habitude`} />
        <Kpi icon={<Zap />} tone="energy" label="Énergie de pompage" value={`${formatNumber(r.totals.kwh, 1)} kWh`} hint={`${formatNumber(r.totals.costEur, 2)} € · ${formatNumber(r.comparison.savedEur, 2)} € économisés`} />
        <Kpi icon={<CloudRain />} tone="muted" label="Pluie prévue" value={`${formatNumber(r.totals.rainMm, 1)} mm`} hint={`Évaporation ${formatNumber(r.totals.et0Mm, 1)} mm`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <WeekCard plan={p} />
        <div className="space-y-5">
          <AiCard plan={p} />
          <AskCard planId={p.id} />
        </div>
      </div>

      <ChartCard plan={p} />
    </div>
  )
}

function Kpi({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: 'water' | 'leaf' | 'energy' | 'muted' }) {
  const toneCls = { water: 'bg-water/12 text-water-fg', leaf: 'bg-leaf/12 text-leaf-fg', energy: 'bg-energy/12 text-energy-fg', muted: 'bg-muted text-muted-foreground' }[tone]
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={cn('flex size-7 items-center justify-center rounded-lg [&_svg]:size-4', toneCls)} aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <p className="tabular mt-2 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

// ─────────────────────────────── Semaine jour par jour ───────────────────────────────

function WeekCard({ plan: p }: { plan: SavedPlan }) {
  const { i18n } = useTranslation()
  const setDay = useSetDay()
  const t0 = today()
  return (
    <section className="rounded-3xl border bg-card p-5 sm:p-6" aria-labelledby="week-title">
      <h3 id="week-title" className="flex items-center gap-2 text-lg font-semibold">
        <CalendarCheck className="size-5 text-water-fg" aria-hidden="true" /> Planning des 7 jours
      </h3>
      <ol className="mt-4 space-y-2">
        {p.plan.days.map((d, i) => {
          const done = p.doneDays.includes(d.date)
          const past = d.date <= t0
          return (
            <motion.li
              key={d.date}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn('flex items-center gap-3 rounded-2xl border p-3', d.irrigate ? 'border-water/35 bg-water/6' : 'bg-muted/30', d.date === t0 && 'ring-2 ring-water/40')}
            >
              <div className="w-20 shrink-0">
                <p className="text-sm font-semibold capitalize">{d.date === t0 ? 'Aujourd’hui' : dayLabel(d.date, i18n.language)}</p>
                <p className="tabular text-xs text-muted-foreground">
                  {Math.round(d.tMin)}–{Math.round(d.tMax)} °C
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium">
                  {d.irrigate ? (
                    <>
                      <Droplets className="size-4 text-water-fg" aria-hidden="true" /> Arroser {formatNumber(d.volumeM3, 1)} m³
                      {d.litersPerTree ? <span className="text-xs font-normal text-muted-foreground">({formatNumber(d.litersPerTree)} L/arbre{d.durationH ? `, ${formatNumber(d.durationH, 1)} h` : ''})</span> : null}
                    </>
                  ) : d.rain >= 5 ? (
                    <>
                      <CloudRain className="size-4 text-muted-foreground" aria-hidden="true" /> Pluie {formatNumber(d.rain, 1)} mm : pas d’arrosage
                    </>
                  ) : (
                    <span className="text-muted-foreground">Pas d’arrosage</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{d.reason}</p>
                {d.alerts.map((a) => (
                  <p key={a} className="mt-0.5 flex items-center gap-1 text-xs font-medium text-energy-fg">
                    {a.startsWith('Risque de gel') ? <Snowflake className="size-3.5" aria-hidden="true" /> : <Flame className="size-3.5" aria-hidden="true" />} {a}
                  </p>
                ))}
              </div>
              {d.irrigate && (
                <Button
                  variant={done ? 'default' : 'outline'}
                  size="sm"
                  className={cn('shrink-0', done && 'bg-leaf text-white hover:bg-leaf/90')}
                  disabled={!past || setDay.isPending}
                  title={past ? undefined : 'Vous pourrez cocher ce jour une fois arrivé'}
                  onClick={() => setDay.mutate({ id: p.id, date: d.date, done: !done }, { onError: (e) => toast.error(apiErrorMessage(e)) })}
                  aria-pressed={done}
                >
                  <CheckCircle2 aria-hidden="true" /> {done ? 'Fait' : 'Marquer fait'}
                </Button>
              )}
            </motion.li>
          )
        })}
      </ol>
    </section>
  )
}

// ─────────────────────────────── IA ───────────────────────────────

function AiCard({ plan: p }: { plan: SavedPlan }) {
  const ai = p.plan.ai
  return (
    <section className="rounded-3xl border bg-gradient-to-br from-water/10 via-card to-leaf/8 p-5 sm:p-6" aria-labelledby="ai-title">
      <div className="flex items-start justify-between gap-3">
        <h3 id="ai-title" className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="size-5 text-water-fg" aria-hidden="true" /> Votre plan expliqué
        </h3>
        <ListenButton text={`${ai.summary} ${ai.tips.join('. ')}`} />
      </div>
      <p className="mt-3 text-sm leading-relaxed">{ai.summary}</p>
      <ul className="mt-4 space-y-2">
        {ai.tips.map((tip) => (
          <li key={tip} className="flex gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-leaf-fg" aria-hidden="true" /> {tip}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        {ai.source === 'llm' ? 'Texte rédigé par l’IA (Gemini). ' : 'Réponse simulée (IA indisponible). '}Les volumes sont calculés par la méthode FAO-56, pas par l’IA.
      </p>
    </section>
  )
}

function AskCard({ planId }: { planId: string }) {
  const ask = useAskPlan()
  const [q, setQ] = useState('')
  const [answers, setAnswers] = useState<{ q: string; a: string }[]>([])
  const suggestions = ['Puis-je arroser le soir ?', 'Pourquoi pas d’arrosage demain ?', 'Combien d’eau par arbre ?']

  async function send(question: string) {
    if (question.trim().length < 3) return
    try {
      const r = await ask.mutateAsync({ id: planId, question: question.trim() })
      setAnswers((a) => [...a, { q: question.trim(), a: r.answer }])
      setQ('')
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <section className="rounded-3xl border bg-card p-5 sm:p-6" aria-labelledby="ask-title">
      <h3 id="ask-title" className="flex items-center gap-2 text-lg font-semibold">
        <Bot className="size-5 text-water-fg" aria-hidden="true" /> Une question sur ce plan ?
      </h3>
      <div className="mt-3 space-y-3" aria-live="polite">
        {answers.map((x, i) => (
          <div key={i} className="space-y-1.5">
            <p className="ms-auto w-fit max-w-[85%] rounded-2xl rounded-ee-sm bg-water/15 px-3 py-2 text-sm">{x.q}</p>
            <p className="w-fit max-w-[90%] rounded-2xl rounded-es-sm bg-muted px-3 py-2 text-sm">{x.a}</p>
          </div>
        ))}
        {ask.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Réponse en cours" />}
      </div>
      {answers.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          send(q)
        }}
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex : dois-je arroser s’il fait 38 °C ?" aria-label="Votre question" maxLength={300} />
        <Button type="submit" size="icon" disabled={ask.isPending || q.trim().length < 3} aria-label="Envoyer">
          <Send aria-hidden="true" />
        </Button>
      </form>
    </section>
  )
}

// ─────────────────────────────── Graphique ───────────────────────────────

function ChartCard({ plan: p }: { plan: SavedPlan }) {
  const { i18n } = useTranslation()
  const data = useMemo(() => p.plan.days.map((d) => ({ day: dayLabel(d.date, i18n.language), eau: d.volumeM3, pluie: d.rain, besoin: d.etc })), [p.plan.days, i18n.language])
  return (
    <section className="rounded-3xl border bg-card p-5 sm:p-6" aria-labelledby="chart-title">
      <h3 id="chart-title" className="text-lg font-semibold">
        Besoin de la culture, pluie et arrosages
      </h3>
      <p className="text-sm text-muted-foreground">Barres : eau à apporter (m³). Lignes : besoin de la culture et pluie (mm/jour).</p>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: WATER }} /> Arrosage (m³)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: '#10B981' }} /> Besoin de la culture (mm)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: RAIN }} /> Pluie (mm)
        </span>
      </div>
      <div className="mt-3 h-64" role="img" aria-label="Graphique de l’arrosage, du besoin de la culture et de la pluie sur 7 jours">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} className="capitalize" />
            <YAxis yAxisId="m3" tickLine={false} axisLine={false} fontSize={12} width={44} />
            <YAxis yAxisId="mm" hide />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--popover-foreground)', fontSize: 12 }}
              formatter={(v, name) => [name === 'eau' ? `${formatNumber(Number(v), 1)} m³` : `${formatNumber(Number(v), 1)} mm`, name === 'eau' ? 'Arrosage' : name === 'pluie' ? 'Pluie' : 'Besoin']}
            />
            <Bar yAxisId="m3" dataKey="eau" fill={WATER} radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Line yAxisId="mm" dataKey="besoin" stroke="#10B981" strokeWidth={2} dot={{ r: 3 }} />
            <Line yAxisId="mm" dataKey="pluie" stroke={RAIN} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

// ─────────────────────────────── Création ───────────────────────────────

function NewPlanDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const terrains = useTerrains()
  const species = useSpecies()
  const create = useCreatePlan()
  const profile = useProfile()
  const [terrainId, setTerrainId] = useState('')
  const [form, setForm] = useState({ name: '', speciesId: 'olivier', areaHa: '1', trees: '280', irrigation: 'goutte-a-goutte' as IrrigationSystem, plantingYear: '2015', pumpHeadM: '30', kwhPrice: '0.25' })
  const [place, setPlace] = useState<PickedPlace | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Lieu par défaut : celui du profil (si l'utilisateur ne choisit pas un terrain)
  useEffect(() => {
    const p = profile.data
    if (open && !place && p?.lat != null && p.lng != null && !terrainId) setPlace({ name: p.placeName ?? 'Mon exploitation', lat: p.lat, lng: p.lng })
  }, [open, profile.data, terrainId, place])
  const sp = species.data?.find((s) => s.id === form.speciesId)
  const isTree = sp?.kind !== 'crop'

  // Pré-remplissage depuis un terrain TerraCalc
  function pickTerrain(id: string) {
    setTerrainId(id)
    const ter = terrains.data?.find((x) => x.id === id)
    if (!ter) return
    setForm((f) => ({
      ...f,
      name: ter.name,
      speciesId: ter.speciesId ?? f.speciesId,
      areaHa: String(Math.round((ter.areaM2 / 10_000) * 100) / 100),
      trees: ter.estimate?.trees?.count ? String(ter.estimate.trees.count) : f.trees,
      irrigation: ter.irrigation && ter.irrigation !== 'pluvial' ? ter.irrigation : 'goutte-a-goutte',
      plantingYear: ter.plantingYear ? String(ter.plantingYear) : f.plantingYear,
    }))
    setPlace({ name: `Terrain « ${ter.name} »`, lat: Math.round(ter.centroidLat * 1e4) / 1e4, lng: Math.round(ter.centroidLng * 1e4) / 1e4 })
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const n = (s: string) => Number(s.replace(',', '.'))
    if (form.name.trim().length < 2) return setError('Donnez un nom au plan (2 caractères minimum).')
    if (!(n(form.areaHa) > 0)) return setError('Indiquez une surface valide.')
    if (isTree && !(n(form.trees) >= 1)) return setError('Indiquez le nombre d’arbres.')
    if (!place) return setError('Indiquez le lieu du champ : tapez une ville (ex. Ariana) ou utilisez votre position.')
    try {
      const plan = await create.mutateAsync({
        name: form.name.trim(),
        terrainId: terrainId || undefined,
        speciesId: form.speciesId,
        areaM2: n(form.areaHa) * 10_000,
        trees: isTree ? Math.round(n(form.trees)) : null,
        lat: place.lat,
        lng: place.lng,
        irrigation: form.irrigation,
        plantingYear: form.plantingYear ? Math.round(n(form.plantingYear)) : null,
        pumpHeadM: n(form.pumpHeadM),
        kwhPrice: n(form.kwhPrice),
      })
      toast.success(`Plan « ${plan.name} » créé`, { description: `${plan.plan.totals.irrigationDays} arrosage(s) cette semaine, ${formatNumber(plan.plan.totals.volumeM3, 1)} m³.` })
      onCreated(plan.id)
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  const field = 'h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau plan d’irrigation</DialogTitle>
          <DialogDescription>Le plan est calculé avec la météo réelle des 7 prochains jours à cet endroit.</DialogDescription>
        </DialogHeader>
        <form id="plan-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {!!terrains.data?.length && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pl-terrain">À partir d’un terrain TerraCalc</Label>
              <select id="pl-terrain" className={field} value={terrainId} onChange={(e) => pickTerrain(e.target.value)}>
                <option value="">Saisie manuelle</option>
                {terrains.data.map((ter) => (
                  <option key={ter.id} value={ter.id}>
                    {ter.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pl-name">Nom du plan</Label>
            <Input id="pl-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex : Oliveraie du nord" maxLength={60} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-species">Culture</Label>
            <select id="pl-species" className={field} value={form.speciesId} onChange={(e) => set('speciesId', e.target.value)}>
              {species.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-irr">Irrigation</Label>
            <select id="pl-irr" className={field} value={form.irrigation} onChange={(e) => set('irrigation', e.target.value)}>
              {(Object.keys(SYSTEM_LABEL) as IrrigationSystem[]).map((k) => (
                <option key={k} value={k}>
                  {SYSTEM_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-area">Surface (ha)</Label>
            <Input id="pl-area" inputMode="decimal" value={form.areaHa} onChange={(e) => set('areaHa', e.target.value)} />
          </div>
          {isTree && (
            <div className="space-y-1.5">
              <Label htmlFor="pl-trees">Nombre d’arbres</Label>
              <Input id="pl-trees" inputMode="numeric" value={form.trees} onChange={(e) => set('trees', e.target.value)} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="pl-year">Année de plantation</Label>
            <Input id="pl-year" inputMode="numeric" value={form.plantingYear} onChange={(e) => set('plantingYear', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pl-head">Hauteur de pompage (m)</Label>
            <Input id="pl-head" inputMode="decimal" value={form.pumpHeadM} onChange={(e) => set('pumpHeadM', e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="pl-place">Lieu du champ</Label>
            <LocationField id="pl-place" value={place} onChange={setPlace} />
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="plan-form" disabled={create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {create.isPending ? 'Calcul en cours…' : 'Calculer le plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
