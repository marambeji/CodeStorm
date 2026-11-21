import { motion } from 'framer-motion'
import { AlertTriangle, Banknote, CheckCircle2, Coins, Droplets, FileDown, Hourglass, Leaf, Loader2, Save, ShieldAlert, Sparkles, Sprout, TreeDeciduous, Wheat } from 'lucide-react'
import type { ReactNode } from 'react'
import { AnimatedNumber } from '@/components/common/animated-number'
import { revealItem } from '@/components/fx/reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSiteCheck } from '../api'
import { formatEur, formatKg, formatNumber } from '../geo'
import type { Polygon } from 'geojson'
import { IRRIGATION_LABEL, type Estimate } from '../types'
import { ProductionChart } from './production-chart'

const fmtKg = (n: number) => formatKg(n)
const fmtEur = (n: number) => formatEur(n)
const fmtInt = (n: number) => formatNumber(n)

/** Étape 3 : rapport d'estimation (chiffres du moteur + analyse de l'IA) */
export function StepReport({
  estimate,
  loading,
  error,
  price,
  onPrice,
  onSave,
  onPdf,
  saving,
  saved,
  polygon,
}: {
  polygon?: Polygon | null
  estimate: Estimate | undefined
  loading: boolean
  error: string | null
  price: number | null
  onPrice: (p: number | null) => void
  onSave: () => void
  onPdf: () => void
  saving: boolean
  saved: boolean
}) {
  if (error && !estimate) return <p className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>
  if (!estimate) return <ReportSkeleton />

  const e = estimate
  const isTree = Boolean(e.trees)

  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className={cn('space-y-6 transition-opacity', loading && 'opacity-60')}>
      {polygon && <SiteCheckCard polygon={polygon} />}

      {/* Chiffre principal */}
      <motion.section variants={revealItem} className="rounded-2xl bg-gradient-to-br from-leaf/18 via-leaf/6 to-transparent p-5 ring-1 ring-inset ring-leaf/20">
        <p className="text-sm font-medium text-muted-foreground">{e.production.kgPerYear > 0 ? 'Production estimée cette année' : 'Production en pleine maturité'}</p>
        <p className="mt-1 text-5xl font-extrabold tracking-[-0.04em]">
          <AnimatedNumber value={e.production.kgPerYear > 0 ? e.production.kgPerYear : e.production.kgPerYearFull} format={fmtKg} />
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {e.species.name} · {IRRIGATION_LABEL[e.inputs.irrigation].toLowerCase()}
          {isTree && e.age !== null && (e.age > 0 ? ` · arbres de ${e.age} ans` : ' · plantation cette année')}
        </p>
      </motion.section>

      {/* Indicateurs */}
      <motion.div variants={revealItem} className="grid grid-cols-2 gap-3">
        {isTree ? (
          <Kpi icon={<TreeDeciduous />} label="Arbres" value={<AnimatedNumber value={e.trees!.count} format={fmtInt} />} sub={`${formatNumber(e.trees!.densityPerHa)} / ha`} />
        ) : (
          <Kpi icon={<Wheat />} label="Surface cultivée" value={`${formatNumber(e.geometry.areaHa, 2)} ha`} sub="culture annuelle" />
        )}
        <Kpi icon={<Droplets />} label="Eau d’irrigation" value={<AnimatedNumber value={e.water.irrigationM3PerYear} format={(n) => `${fmtInt(n)} m³`} />} sub="par an" tone="water" />
        <Kpi icon={<Banknote />} label="Revenu estimé" value={<AnimatedNumber value={e.economics.revenuePerYear} format={fmtEur} />} sub="par an" tone="energy" />
        <Kpi icon={<Coins />} label="Coût d’installation" value={<AnimatedNumber value={e.economics.installationCost} format={fmtEur} />} sub={isTree ? 'plants + irrigation + sol' : 'par campagne'} tone="energy" />
        <Kpi
          icon={<Hourglass />}
          label="Retour sur investissement"
          value={e.economics.paybackYears ? `${e.economics.paybackYears} an${e.economics.paybackYears > 1 ? 's' : ''}` : 'Non rentable'}
          sub="après la plantation"
        />
        <Kpi icon={<Leaf />} label="CO₂ absorbé" value={<AnimatedNumber value={e.co2.kgPerYear} format={fmtKg} />} sub="par an" />
      </motion.div>

      <motion.div variants={revealItem}>
        <ProductionChart projection={e.projection} />
      </motion.div>

      {/* Eau */}
      <motion.section variants={revealItem} className="space-y-2 rounded-2xl border bg-background/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Droplets className="size-4 text-water-fg" aria-hidden="true" /> Eau et irrigation
        </h3>
        <p className="text-sm text-muted-foreground">
          Besoin des plantes : <strong className="tabular text-foreground">{formatNumber(e.water.needM3PerYear)} m³/an</strong>
          {isTree && e.water.needM3PerYearAdult !== e.water.needM3PerYear && <> (adultes : {formatNumber(e.water.needM3PerYearAdult)} m³)</>}. Avec une efficience de{' '}
          {Math.round(e.water.efficiency * 100)} %, il faut pomper <strong className="tabular text-foreground">{formatNumber(e.water.irrigationM3PerYear)} m³</strong>, soit{' '}
          {formatNumber(e.water.m3PerHa)} m³/ha.
        </p>
        {e.water.climate ? (
          <p className="text-xs text-muted-foreground">
            Calculé avec le climat réel de cet endroit ({e.water.climate.source === 'nasa-power' ? `moyennes NASA POWER ${e.water.climate.from}-${e.water.climate.to}` : `Open-Meteo, 12 derniers mois`}) : pluie{' '}
            <strong className="tabular text-foreground">{formatNumber(e.water.climate.rainMm)} mm/an</strong>, évaporation{' '}
            <strong className="tabular text-foreground">{formatNumber(e.water.climate.et0Mm)} mm/an</strong>
            {e.water.m3PerTreeAdult ? <>, soit {formatNumber(e.water.m3PerTreeAdult)} m³ par arbre adulte</> : null} (méthode FAO-56).
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Climat local indisponible : besoin calculé avec les moyennes de l’espèce.</p>
        )}
        <p className="rounded-lg bg-water/10 px-3 py-2 text-sm">{e.water.advice}</p>
      </motion.section>

      {/* Économie */}
      <motion.section variants={revealItem} className="space-y-3 rounded-2xl border bg-background/50 p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Banknote className="size-4 text-energy-fg" aria-hidden="true" /> Économie
        </h3>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="tc-price">Prix de vente</Label>
            <div className="relative">
              <Input
                id="tc-price"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.05}
                value={price ?? e.economics.pricePerKg}
                onChange={(ev) => onPrice(ev.target.value === '' ? null : Math.max(0, Number(ev.target.value)))}
                className="pr-14"
              />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground">€/kg</span>
            </div>
          </div>
          {price !== null && (
            <Button variant="ghost" size="sm" onClick={() => onPrice(null)}>
              Prix moyen
            </Button>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-sm">
          <Money label="Revenu" value={e.economics.revenuePerYear} />
          <Money label={isTree ? 'Entretien' : 'Campagne'} value={-e.economics.maintenancePerYear} />
          <Money label="Marge" value={e.economics.netPerYear} strong />
        </dl>
      </motion.section>

      {/* Analyse IA */}
      <motion.section variants={revealItem} className="relative overflow-hidden rounded-2xl border p-4">
        <div aria-hidden="true" className="absolute -top-16 -right-16 size-40 rounded-full bg-[conic-gradient(from_90deg,#10B981,#0EA5E9,#F59E0B,#10B981)] opacity-15 blur-2xl" />
        <div className="relative space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-energy-fg" aria-hidden="true" /> Analyse de l’IA
            </h3>
            {e.ai.source === 'mock' && <Badge variant="outline">Réponse simulée</Badge>}
          </div>
          <p className="text-sm leading-relaxed">{e.ai.summary}</p>
          <ul className="space-y-2">
            {e.ai.tips.map((t) => (
              <li key={t} className="flex gap-2 text-sm text-muted-foreground">
                <Sprout className="mt-0.5 size-4 shrink-0 text-leaf-fg" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Niveau de confiance</span>
              <span className="tabular font-semibold">{Math.round(e.ai.confidence * 100)} %</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={Math.round(e.ai.confidence * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Niveau de confiance">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-leaf to-water" initial={{ width: 0 }} animate={{ width: `${e.ai.confidence * 100}%` }} transition={{ duration: 0.8 }} />
            </div>
          </div>
        </div>
      </motion.section>

      <p className="text-xs leading-relaxed text-muted-foreground">⚠️ {e.disclaimer}</p>

      {/* Actions */}
      <div className="sticky bottom-0 -mx-1 grid grid-cols-2 gap-2 bg-gradient-to-t from-[var(--glass-strong)] via-[var(--glass-strong)] to-transparent px-1 pt-4 pb-1">
        <Button size="lg" variant="module" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {saved ? 'Mettre à jour' : 'Enregistrer'}
        </Button>
        <Button size="lg" variant="outline" onClick={onPdf}>
          <FileDown aria-hidden="true" /> Rapport PDF
        </Button>
      </div>
    </motion.div>
  )
}

const VERDICT = {
  adapte: { label: 'Terrain adapté à la plantation', icon: CheckCircle2, className: 'bg-leaf/10 ring-leaf/25 text-leaf-fg' },
  'a-verifier': { label: 'Terrain à vérifier', icon: AlertTriangle, className: 'bg-energy/10 ring-energy/30 text-energy-fg' },
  inadapte: { label: 'Terrain inadapté à la plantation', icon: ShieldAlert, className: 'bg-red-500/10 ring-red-500/30 text-red-600 dark:text-red-400' },
} as const

/** Vérification du terrain sur l'image satellite (IA) : zone urbaine, bâtiments, arbres existants… */
function SiteCheckCard({ polygon }: { polygon: Polygon }) {
  const q = useSiteCheck(polygon)
  if (q.isPending)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> L’IA examine le terrain sur l’image satellite…
      </div>
    )
  if (q.isError || !q.data?.available || !q.data.verdict) return null
  const v = VERDICT[q.data.verdict]
  const Icon = v.icon
  return (
    <section className={cn('space-y-2 rounded-2xl p-4 ring-1 ring-inset', v.className)} aria-live="polite">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Icon className="size-4" aria-hidden="true" /> {v.label}
      </p>
      <p className="text-sm text-foreground">{q.data.summary}</p>
      {!!q.data.issues?.length && (
        <ul className="list-disc space-y-0.5 ps-5 text-sm text-foreground/80">
          {q.data.issues.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Vérifié par l’IA sur l’image satellite · bâti {Math.round((q.data.builtShare ?? 0) * 100)} % · arbres existants {Math.round((q.data.existingTreesShare ?? 0) * 100)} % · confiance{' '}
        {Math.round((q.data.confidence ?? 0) * 100)} %
      </p>
    </section>
  )
}

function Kpi({ icon, label, value, sub, tone = 'leaf' }: { icon: ReactNode; label: string; value: ReactNode; sub: string; tone?: 'leaf' | 'water' | 'energy' }) {
  const color = { leaf: 'text-leaf-fg', water: 'text-water-fg', energy: 'text-energy-fg' }[tone]
  return (
    <div className="rounded-2xl border bg-background/50 p-3.5">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
        <span className={color}>{icon}</span>
        {label}
      </p>
      <p className="tabular mt-1.5 text-xl font-extrabold tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={cn('rounded-xl px-2 py-2.5', strong ? 'bg-leaf/10' : 'bg-muted/50')}>
      <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
      <dd className={cn('tabular mt-0.5 font-bold', strong && (value >= 0 ? 'text-leaf-fg' : 'text-destructive'))}>{formatEur(value)}</dd>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Calcul de l’estimation">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  )
}
