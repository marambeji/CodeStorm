import { AlertTriangle, Bell, Droplets, Gauge, LandPlot, LayoutDashboard, Leaf, Search, Sprout } from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'
import { useDashboard, type Dashboard } from '@/features/dashboard/api'

const nf = (n: number, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n)

/** Chiffres affichés : ceux de l'application (données réelles), ou un exemple si le serveur ne répond pas */
function mockData(d: Dashboard | undefined) {
  if (!d)
    return {
      score: 72,
      water: '312 L/j',
      waterSub: 'eau du foyer',
      irrigation: '1 754 m³',
      irrigationSub: '−45 % d’eau',
      crops: '68 %',
      alerts: [
        { title: 'Fuite possible', meta: 'Compteur maison', color: 'bg-red-500' },
        { title: 'Mildiou de la tomate', meta: 'Parcelle Nord', color: 'bg-leaf' },
        { title: 'Arroser aujourd’hui', meta: 'Oliveraie', color: 'bg-water' },
      ],
      water7: [310, 305, 320, 300, 315, 812, 790],
      irr7: [0, 0, 0, 1754, 0, 0, 0],
    }
  const m = d.modules
  const color: Record<string, string> = { aquascan: 'bg-red-500', plantdoc: 'bg-leaf', irriplan: 'bg-water', terracalc: 'bg-leaf' }
  return {
    score: d.ecoScore,
    water: m.aquascan.meters ? `${nf(m.aquascan.usualLitersPerDay)} L/j` : '–',
    waterSub: m.aquascan.leaks ? `${m.aquascan.leaks} fuite(s)` : 'aucune fuite',
    irrigation: m.irriplan.plans ? `${nf(m.irriplan.weekM3)} m³` : '–',
    irrigationSub: m.irriplan.plans ? `${nf(m.irriplan.savedM3)} m³ économisés` : 'aucun plan',
    crops: m.plantdoc.healthyShare !== null ? `${Math.round(m.plantdoc.healthyShare * 100)} %` : '–',
    alerts: d.alerts.slice(0, 3).map((a) => ({ title: a.title, meta: a.detail, color: color[a.module] ?? 'bg-muted-foreground' })),
    water7: m.aquascan.series.map((x) => x.liters),
    irr7: m.irriplan.series.map((x) => x.m3),
  }
}

/**
 * Aperçu (maquette) du dashboard dans un cadre de navigateur.
 * C'est une image "vivante" en JSX : nette à toutes les tailles, suit le thème clair/sombre,
 * et ne pèse rien (pas de capture PNG).
 */
export function DashboardMockup() {
  const dash = useDashboard()
  const v = mockData(dash.data)
  return (
    <div
      role="img"
      aria-label={`Aperçu du tableau de bord EcoNexus : éco-score de ${v.score} sur 100, eau, irrigation et alertes récentes`}
      className="overflow-hidden rounded-2xl border bg-background/80 shadow-[var(--shadow-float)] ring-1 ring-black/5 backdrop-blur-xl sm:rounded-[1.25rem] dark:ring-white/5"
    >
      {/* Barre du navigateur */}
      <div className="flex h-9 items-center gap-3 border-b bg-muted/50 px-3 sm:h-11 sm:px-4">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]" />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="size-2.5 rounded-full bg-[#28C840]" />
        </div>
        <div className="mx-auto flex h-6 w-full max-w-xs items-center justify-center rounded-md bg-background/80 px-3 text-[0.65rem] text-muted-foreground sm:text-xs">
          econexus.app/app
        </div>
        <div className="w-10" />
      </div>

      <div className="flex text-left">
        {/* Sidebar */}
        <div className="hidden w-48 shrink-0 flex-col gap-1 border-r p-3 md:flex">
          <div className="mb-3 flex items-center gap-2 px-1 text-sm font-bold">
            <LogoMark className="size-6" /> EcoNexus
          </div>
          <MockNav icon={LayoutDashboard} label="Vue d'ensemble" active />
          <MockNav icon={Leaf} label="PlantDoc" color="text-leaf-fg" />
          <MockNav icon={LandPlot} label="TerraCalc" color="text-leaf-fg" />
          <MockNav icon={Sprout} label="IrriPlan" color="text-water-fg" />
          <MockNav icon={Gauge} label="AquaScan" color="text-water-fg" />
        </div>

        {/* Contenu */}
        <div className="min-w-0 flex-1 space-y-3 p-3 sm:space-y-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold tracking-tight sm:text-lg">Vue d'ensemble</p>
              <p className="hidden text-xs text-muted-foreground sm:block">{dash.data ? 'Données en direct de l’application' : 'Exemple'}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden h-8 items-center gap-2 rounded-lg border bg-background px-3 text-xs text-muted-foreground lg:flex">
                <Search className="size-3.5" /> Rechercher… <kbd className="rounded border px-1 text-[0.6rem]">Ctrl K</kbd>
              </div>
              <div className="relative flex size-8 items-center justify-center rounded-lg border bg-background">
                <Bell className="size-3.5" />
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-energy ring-2 ring-background" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
            {/* Éco-score */}
            <div className="col-span-3 flex items-center gap-3 rounded-xl border bg-card p-3 sm:col-span-1 sm:flex-col sm:items-start">
              <ScoreRing value={v.score} />
              <div>
                <p className="text-xs font-semibold">Éco-score</p>
                <p className="text-[0.65rem] text-leaf-fg">sur 100</p>
              </div>
            </div>
            <Kpi icon={Droplets} label="Eau du foyer" value={v.water} delta={v.waterSub} color="text-water-fg" />
            <Kpi icon={Sprout} label="Irrigation (7 j)" value={v.irrigation} delta={v.irrigationSub} color="text-water-fg" />
            <Kpi icon={Leaf} label="Cultures" value={v.crops} delta="saines ou traitées" color="text-leaf-fg" />
          </div>

          <div className="grid gap-2 sm:gap-3 lg:grid-cols-3">
            {/* Graphique */}
            <div className="rounded-xl border bg-card p-3 lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold">Eau du foyer et irrigation</p>
                <div className="flex gap-3 text-[0.6rem] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-water" /> Eau du foyer
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-leaf" /> Irrigation
                  </span>
                </div>
              </div>
              <MiniChart a={v.water7} b={v.irr7} />
            </div>
            {/* Alertes */}
            <div className="hidden space-y-2 rounded-xl border bg-card p-3 sm:block">
              <p className="text-xs font-semibold">Alertes</p>
              {v.alerts.length ? v.alerts.map((a) => <Alert key={a.title} color={a.color} title={a.title} meta={a.meta} />) : <p className="text-[0.65rem] text-muted-foreground">Aucune alerte</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockNav({ icon: Icon, label, active, color }: { icon: typeof Leaf; label: string; active?: boolean; color?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${active ? 'bg-muted font-semibold' : 'text-muted-foreground'}`}>
      <Icon className={`size-3.5 ${color ?? ''}`} /> {label}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, delta, color }: { icon: typeof Leaf; label: string; value: string; delta: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-2.5 sm:p-3">
      <div className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground sm:text-xs">
        <Icon className={`size-3 ${color}`} /> {label}
      </div>
      <p className="tabular mt-1 text-sm font-extrabold tracking-tight sm:text-xl">{value}</p>
      <p className={`text-[0.6rem] sm:text-[0.65rem] ${color}`}>{delta}</p>
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const c = 2 * Math.PI * 16
  return (
    <svg viewBox="0 0 40 40" className="size-11 -rotate-90 sm:size-14">
      <defs>
        <linearGradient id="mock-score" x1="0" x2="1">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="50%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" className="stroke-muted" />
      <circle cx="20" cy="20" r="16" fill="none" strokeWidth="4" stroke="url(#mock-score)" strokeLinecap="round" strokeDasharray={`${(value / 100) * c} ${c}`} />
      <text x="20" y="20" textAnchor="middle" dominantBaseline="central" className="rotate-90 fill-foreground text-[11px] font-extrabold" style={{ transformOrigin: 'center' }}>
        {value}
      </text>
    </svg>
  )
}

/** Deux courbes (valeurs normalisées) : eau du foyer et irrigation */
function MiniChart({ a, b }: { a: number[]; b: number[] }) {
  const path = (vals: number[]) => {
    if (vals.length < 2) return ''
    const max = Math.max(...vals, 1)
    return vals.map((v, i) => `${i ? 'L' : 'M'}${((i / (vals.length - 1)) * 360).toFixed(1)},${(66 - (v / max) * 56).toFixed(1)}`).join(' ')
  }
  const water = path(a)
  const irr = path(b)
  return (
    <svg viewBox="0 0 360 72" className="h-20 w-full sm:h-28" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="mock-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[18, 36, 54].map((y) => (
        <line key={y} x1="0" x2="360" y1={y} y2={y} className="stroke-border" strokeDasharray="3 4" />
      ))}
      {water && <path d={`${water} L360,72 L0,72 Z`} fill="url(#mock-water)" />}
      {water && <path d={water} fill="none" stroke="#0EA5E9" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      {irr && <path d={irr} fill="none" stroke="#10B981" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}

function Alert({ color, title, meta }: { color: string; title: string; meta: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-2">
      <AlertTriangle className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[0.7rem] font-semibold">
          <span className={`size-1.5 rounded-full ${color}`} /> {title}
        </p>
        <p className="truncate text-[0.6rem] text-muted-foreground">{meta}</p>
      </div>
    </div>
  )
}
