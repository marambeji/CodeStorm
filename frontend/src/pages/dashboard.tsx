import { motion } from 'framer-motion'
import { AlertOctagon, AlertTriangle, ArrowUpRight, Award, BellRing, CheckCircle2, Droplets, Info, Lock, ServerCrash, Sprout, Target, TreeDeciduous, Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AnimatedNumber } from '@/components/common/animated-number'
import { EmptyState } from '@/components/common/empty-state'
import { ModuleIcon } from '@/components/common/module-icon'
import { Reveal, RevealItem } from '@/components/fx/reveal'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { PageHeader } from '@/components/layout/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { useDashboard, type AlertSeverity, type Dashboard } from '@/features/dashboard/api'
import { formatKg, formatNumber } from '@/features/terracalc/geo'
import { WeatherWidget } from '@/features/weather/weather'
import { intlLocale } from '@/i18n'
import { MODULES, toneHex, type ModuleDef } from '@/lib/modules'
import { cn } from '@/lib/utils'

const mod = (id: ModuleDef['id']) => MODULES.find((m) => m.id === id)!
const SEVERITY: Record<AlertSeverity, { label: string; color: string; icon: typeof AlertOctagon }> = {
  critique: { label: 'Critique', color: '#EF4444', icon: AlertOctagon },
  élevée: { label: 'Élevée', color: '#F97316', icon: AlertTriangle },
  moyenne: { label: 'Moyenne', color: '#EAB308', icon: AlertTriangle },
  info: { label: 'Info', color: '#0EA5E9', icon: Info },
}

/** Tableau de bord : éco-score, alertes, résumé des 4 modules, objectifs et badges */
export default function DashboardPage() {
  const dash = useDashboard()
  const { t, i18n } = useTranslation()
  const today = new Date().toLocaleDateString(intlLocale(i18n.language), { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <PageHeader title={dash.data?.profile?.name ? `Bonjour ${dash.data.profile.name.split(' ')[0]}` : t('dashboard.title')} description={t('dashboard.subtitle', { date: today })} />
      {dash.isPending && <DashboardSkeleton />}
      {dash.isError && <EmptyState icon={ServerCrash} title={t('dashboard.unavailable')} description={t('dashboard.unavailableDetail')} />}
      {dash.data && <DashboardContent d={dash.data} />}
    </>
  )
}

function DashboardContent({ d }: { d: Dashboard }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <EcoScoreCard d={d} />
        <AlertsCard alerts={d.alerts} />
      </div>

      <WeatherWidget />

      <Reveal className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" stagger={0.06}>
        <RevealItem>
          <ModuleCard id="plantdoc" metric={d.modules.plantdoc.healthyShare !== null ? `${Math.round(d.modules.plantdoc.healthyShare * 100)} %` : '–'} caption={t('dashboard.healthy')}>
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">{d.modules.plantdoc.toTreat}</strong> {t('dashboard.toTreat')} · {d.modules.plantdoc.parcels} {t('dashboard.parcels')}
            </p>
            <Meter value={d.modules.plantdoc.healthyShare ?? 0} color={toneHex.leaf} />
          </ModuleCard>
        </RevealItem>
        <RevealItem>
          <ModuleCard id="terracalc" metric={`${formatNumber(d.modules.terracalc.hectares, 1)} ha`} caption={`${d.modules.terracalc.count} ${t('dashboard.terrains')}`}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TreeDeciduous className="size-3.5 text-leaf-fg" aria-hidden="true" /> {formatNumber(d.modules.terracalc.trees)} {t('dashboard.trees')}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatKg(d.modules.terracalc.productionKg)}/{t('dashboard.perYear')} · {formatKg(d.modules.terracalc.co2Kg)} {t('dashboard.co2')}
            </p>
          </ModuleCard>
        </RevealItem>
        <RevealItem>
          <ModuleCard id="irriplan" metric={d.modules.irriplan.plans ? `${formatNumber(d.modules.irriplan.weekM3, 0)} m³` : '–'} caption={d.modules.irriplan.plans ? t('dashboard.weekWater') : t('dashboard.noPlan')}>
            <p className="truncate text-xs text-muted-foreground">
              {d.modules.irriplan.next ? (
                <>
                  {t('dashboard.nextWatering')} : <strong className="text-foreground">{new Date(`${d.modules.irriplan.next.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</strong>
                </>
              ) : (
                <>
                  <strong className="text-leaf-fg">{formatNumber(d.modules.irriplan.savedM3, 0)} m³</strong> {t('dashboard.saved')}
                </>
              )}
            </p>
            <Sparkbars values={d.modules.irriplan.series.map((x) => x.m3)} color={toneHex.water} label="Arrosages prévus sur 7 jours" />
          </ModuleCard>
        </RevealItem>
        <RevealItem>
          <ModuleCard
            id="aquascan"
            metric={d.modules.aquascan.leaks ? t('dashboard.leak') : t('dashboard.ok')}
            metricClass={d.modules.aquascan.leaks ? 'text-red-500' : 'text-leaf-fg'}
            caption={`${d.modules.aquascan.meters} ${t('dashboard.meters')} · ${formatNumber(d.modules.aquascan.usualLitersPerDay)} ${t('dashboard.usual')}`}
          >
            <Sparkbars values={d.modules.aquascan.series.map((s) => s.liters)} color={toneHex.water} highlight={d.modules.aquascan.series.map((s) => s.anomaly)} label="Consommation d’eau par période" />
          </ModuleCard>
        </RevealItem>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-2">
        <GoalsCard goals={d.goals} />
        <BadgesCard badges={d.badges} />
      </div>
    </div>
  )
}

// ─────────────────────────── Éco-score ───────────────────────────

function EcoScoreCard({ d }: { d: Dashboard }) {
  const { t } = useTranslation()
  const label = t(`dashboard.levels.${d.ecoScore >= 75 ? 'excellent' : d.ecoScore >= 60 ? 'good' : d.ecoScore >= 40 ? 'improve' : 'priority'}`)
  return (
    <SpotlightCard color="#10B981" className="p-5 sm:p-7">
      <div className="flex flex-col items-center gap-7 sm:flex-row sm:items-center">
        <ScoreRing score={d.ecoScore} />
        <div className="w-full min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">{t('dashboard.ecoScore')}</p>
            <p className="text-2xl font-extrabold tracking-tight">{label}</p>
            <p className="text-xs text-muted-foreground">{t('dashboard.scoreHint')}</p>
          </div>
          <ul className="space-y-2.5">
            {d.parts.map((p, i) => {
              const m = mod(p.id)
              return (
                <li key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <m.icon className="size-3.5 shrink-0" style={{ color: toneHex[m.tone] }} aria-hidden="true" />
                      <span className="truncate">{t(`dashboard.parts.${p.id}`)}</span>
                    </span>
                    <span className="tabular font-bold">{p.score}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: toneHex[m.tone] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${p.score}%` }}
                      transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </SpotlightCard>
  )
}

function ScoreRing({ score }: { score: number }) {
  const { t } = useTranslation()
  const r = 70
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-48 shrink-0" role="img" aria-label={`Éco-score : ${score} sur 100`}>
      <svg viewBox="0 0 180 180" className="size-full -rotate-90">
        <defs>
          <linearGradient id="eco-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#10B981" />
            <stop offset="55%" stopColor="#0EA5E9" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r={r} fill="none" strokeWidth="14" className="stroke-muted" />
        <motion.circle
          cx="90"
          cy="90"
          r={r}
          fill="none"
          strokeWidth="14"
          stroke="url(#eco-ring)"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - score / 100) }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber value={score} format={(n) => String(Math.round(n))} className="text-5xl font-extrabold tracking-[-0.04em]" />
        <span className="text-xs text-muted-foreground">{t('dashboard.outOf')}</span>
      </div>
      <div aria-hidden="true" className="absolute inset-6 -z-10 rounded-full bg-[conic-gradient(from_0deg,#10B981,#0EA5E9,#F59E0B,#10B981)] opacity-20 blur-2xl" />
    </div>
  )
}

// ─────────────────────────── Alertes ───────────────────────────

function AlertsCard({ alerts }: { alerts: Dashboard['alerts'] }) {
  const { t } = useTranslation()
  return (
    <SpotlightCard color="#EF4444" className="flex flex-col p-5 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <BellRing className="size-5 text-energy-fg" aria-hidden="true" /> {t('dashboard.alerts')}
        </h2>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{alerts.length}</span>
      </div>
      {alerts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="size-8 text-leaf-fg" aria-hidden="true" />
          <p className="font-semibold">{t('dashboard.allGood')}</p>
          <p className="text-sm text-muted-foreground">{t('dashboard.noAlerts')}</p>
        </div>
      ) : (
        <ul className="-mx-2 flex-1 space-y-1 overflow-y-auto px-2 lg:max-h-[19rem]">
          {alerts.map((a) => {
            const s = SEVERITY[a.severity]
            const m = mod(a.module)
            return (
              <li key={a.id}>
                <Link to={a.link} className="group flex gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${s.color}1f`, color: s.color }}>
                    <s.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">{a.title}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">{a.detail}</span>
                    <span className="mt-1 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
                      <span className="font-semibold" style={{ color: s.color }}>
                        {t(`dashboard.severity.${a.severity}`)}
                      </span>
                      · {m.name}
                    </span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </SpotlightCard>
  )
}

// ─────────────────────────── Modules ───────────────────────────

function ModuleCard({ id, metric, caption, metricClass, children }: { id: ModuleDef['id']; metric: string; caption: string; metricClass?: string; children?: ReactNode }) {
  const m = mod(id)
  return (
    <SpotlightCard color={toneHex[m.tone]} className="h-full">
      <Link to={m.path} className="group flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <ModuleIcon icon={m.icon} tone={m.tone} size="sm" />
            <span className="font-semibold">{m.name}</span>
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden="true" />
        </div>
        <div>
          <p className={cn('tabular text-3xl font-extrabold tracking-tight', metricClass)}>{metric}</p>
          <p className="truncate text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="mt-auto space-y-2">{children}</div>
      </Link>
    </SpotlightCard>
  )
}

function Meter({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} whileInView={{ width: `${value * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
    </div>
  )
}

/** Mini-histogramme (sparkline en barres), décoratif : la valeur clé est affichée en texte */
function Sparkbars({ values, color, highlight, label }: { values: number[]; color: string; highlight?: boolean[]; label: string }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-10 items-end gap-[3px]" role="img" aria-label={label}>
      {values.map((v, i) => (
        <motion.span
          key={i}
          className="flex-1 rounded-t-[3px]"
          style={{ backgroundColor: highlight?.[i] ? '#EF4444' : color, opacity: highlight?.[i] ? 1 : 0.35 + (0.65 * (i + 1)) / values.length }}
          initial={{ height: 0 }}
          whileInView={{ height: `${Math.max(6, (v / max) * 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.03 }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────── Objectifs & badges ───────────────────────────

const GOAL_COLOR: Record<string, string> = { fuite: toneHex.water, maladies: toneHex.leaf, 'heures-creuses': toneHex.water, 'baisse-conso': toneHex.leaf }
const BADGE_ICON: Record<string, typeof Award> = { 'zero-fuite': Droplets, 'main-verte': Sprout, econome: Zap, goutte: Droplets, vigie: Target, analyste: Award }

function GoalsCard({ goals }: { goals: Dashboard['goals'] }) {
  const { t } = useTranslation()
  return (
    <SpotlightCard color="#0EA5E9" className="p-5 sm:p-6">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
        <Target className="size-5 text-water-fg" aria-hidden="true" /> {t('dashboard.goals')}
      </h2>
      <ul className="space-y-4">
        {goals.map((g) => (
          <li key={g.id}>
            <Link to={g.link} className="block space-y-1.5 rounded-xl p-1 transition-colors hover:bg-muted/50">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">{g.label}</span>
                <span className="tabular shrink-0 font-bold">{Math.round(g.progress * 100)} %</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: GOAL_COLOR[g.id] ?? toneHex.leaf }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${g.progress * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{g.detail}</p>
            </Link>
          </li>
        ))}
      </ul>
    </SpotlightCard>
  )
}

function BadgesCard({ badges }: { badges: Dashboard['badges'] }) {
  const { t } = useTranslation()
  const unlocked = badges.filter((b) => b.unlocked).length
  return (
    <SpotlightCard color="#F59E0B" className="p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Award className="size-5 text-energy-fg" aria-hidden="true" /> {t('dashboard.badges')}
        </h2>
        <span className="text-sm text-muted-foreground">
          {unlocked} / {badges.length} {t('dashboard.unlocked')}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((b, i) => {
          const Icon = BADGE_ICON[b.id] ?? Award
          return (
            <motion.li
              key={b.id}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className={cn('flex flex-col items-center gap-2 rounded-2xl border p-3 text-center', b.unlocked ? 'bg-energy/8' : 'opacity-55')}
              title={b.description}
            >
              <span
                className={cn(
                  'relative flex size-12 items-center justify-center rounded-full',
                  b.unlocked ? 'bg-[conic-gradient(from_200deg,#10B981,#0EA5E9,#F59E0B,#10B981)] p-[2px]' : 'bg-muted',
                )}
              >
                <span className={cn('flex size-full items-center justify-center rounded-full', b.unlocked ? 'bg-card text-energy-fg' : 'text-muted-foreground')}>
                  {b.unlocked ? <Icon className="size-5" aria-hidden="true" /> : <Lock className="size-4" aria-hidden="true" />}
                </span>
              </span>
              <span className="text-xs font-semibold">{b.label}</span>
              <span className="sr-only">{b.unlocked ? 'débloqué' : 'à débloquer'} : </span>
              <span className="text-[0.65rem] leading-snug text-muted-foreground">{b.description}</span>
            </motion.li>
          )
        })}
      </ul>
    </SpotlightCard>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Chargement du tableau de bord">
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-72 rounded-3xl" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-48 rounded-3xl" />
        ))}
      </div>
    </div>
  )
}
