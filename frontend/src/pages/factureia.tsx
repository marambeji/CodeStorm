import { motion } from 'framer-motion'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, FilePlus2, FileText, FlaskConical, Loader2, PencilLine, Receipt, Sparkles, Trash2, Zap } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AnimatedNumber } from '@/components/common/animated-number'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DropZone } from '@/components/common/drop-zone'
import { EmptyState } from '@/components/common/empty-state'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { useAnalyzeInvoice, useDeleteInvoice, useInvoices, useSaveInvoice, useTariffs } from '@/features/factureia/api'
import { sampleInvoicePdf } from '@/features/factureia/sample-invoice'
import { DEFAULT_SIMULATION, simulateSavings, type SimulatorInput } from '@/features/factureia/simulator'
import { MISSING_LABEL, type Invoice, type InvoiceInput } from '@/features/factureia/types'
import { ListenButton } from '@/features/plantdoc/components'
import { apiErrorMessage } from '@/features/terracalc/api'
import { formatNumber } from '@/features/terracalc/geo'
import { MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils'

const MODULE = MODULES.find((m) => m.id === 'factureia')!
const HP = '#F59E0B'
const HC = '#6366F1'
// Montants : toujours 2 décimales (126,70 €), espace insécable avant le symbole
const eurFmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const eur = (n: number) => `${eurFmt.format(n).replace(/\u202f/g, '\u00a0')}\u00a0€`
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const month = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'short', timeZone: 'UTC' }).replace('.', '')

/** FactureIA : lecture de facture, explication, évolution et simulateur d'économies */
export default function FactureIAPage() {
  const { t } = useTranslation()
  const invoices = useInvoices()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<{ open: boolean; invoice: Invoice | null }>({ open: false, invoice: null })
  const list = invoices.data ?? []
  const selected = list.find((i) => i.id === selectedId) ?? list.at(-1) ?? null

  return (
    <>
      <PageHeader
        title={MODULE.name}
        description={t('modules.factureia.description')} icon={MODULE.icon}
        tone="energy"
        meta={<Badge variant="outline">{t('themes.energie')}</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)]">
        <UploadCard latest={list.at(-1) ?? null} onUploaded={(inv) => setSelectedId(inv.id)} onManual={() => setForm({ open: true, invoice: null })} />
        {invoices.isPending ? (
          <Skeleton className="h-[30rem] rounded-3xl" />
        ) : invoices.isError ? (
          <EmptyState icon={Receipt} title="Factures indisponibles" description={apiErrorMessage(invoices.error)} />
        ) : selected ? (
          <InvoiceDetail key={selected.id} invoice={selected} onEdit={() => setForm({ open: true, invoice: selected })} onDeleted={() => setSelectedId(null)} />
        ) : (
          <EmptyState icon={FileText} title="Aucune facture" description="Déposez votre première facture PDF ou saisissez-la à la main pour obtenir son explication." />
        )}
      </div>

      {list.length > 0 && (
        <>
          <SpotlightCard color={HP} className="mt-5 p-5 sm:p-6">
            <ConsumptionChart invoices={list} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </SpotlightCard>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Simulator invoice={selected} />
            <HistoryList invoices={list} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
          </div>
        </>
      )}

      <InvoiceFormDialog
        open={form.open}
        invoice={form.invoice}
        onClose={() => setForm({ open: false, invoice: null })}
        onSaved={(inv) => setSelectedId(inv.id)}
      />
    </>
  )
}

// ─────────────────────────── Envoi ───────────────────────────

function UploadCard({ latest, onUploaded, onManual }: { latest: Invoice | null; onUploaded: (i: Invoice) => void; onManual: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const analyze = useAnalyzeInvoice()

  async function send(f: File) {
    try {
      const inv = await analyze.mutateAsync(f)
      setFile(null)
      onUploaded(inv)
      if (inv.extraction === 'partielle') toast.warning('Facture lue en partie', { description: 'Vérifiez les champs signalés et corrigez-les.' })
      else toast.success('Facture analysée', { description: inv.label })
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <SpotlightCard color={HP} className="flex flex-col p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold">Analyser une facture</h2>
      <div className="flex flex-1 flex-col gap-4">
        <DropZone accept="application/pdf" label="Déposez votre facture PDF" hint="Facture d’électricité, 10 Mo maximum" file={file} onFile={setFile} />
        <Button size="lg" variant="module" disabled={!file || analyze.isPending} onClick={() => file && send(file)}>
          {analyze.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {analyze.isPending ? 'Lecture de la facture…' : 'Analyser la facture'}
        </Button>
        <div className="mt-auto grid grid-cols-2 gap-2 border-t pt-4">
          <Button variant="ghost" size="sm" disabled={analyze.isPending} onClick={async () => send(await sampleInvoicePdf(latest?.periodEnd))}>
            <FlaskConical aria-hidden="true" /> Facture d’exemple
          </Button>
          <Button variant="ghost" size="sm" onClick={onManual}>
            <FilePlus2 aria-hidden="true" /> Saisir à la main
          </Button>
        </div>
      </div>
    </SpotlightCard>
  )
}

// ─────────────────────────── Détail ───────────────────────────

const TIER_COLOR = (label: string) => (label.startsWith('Heures pleines') || label === 'Consommation' ? HP : label.startsWith('Heures creuses') ? HC : label.startsWith('Abonnement') ? '#94A3B8' : '#64748B')

function InvoiceDetail({ invoice: inv, onEdit, onDeleted }: { invoice: Invoice; onEdit: () => void; onDeleted: () => void }) {
  const del = useDeleteInvoice()
  const a = inv.analysis
  const change = a.changeVsPrevious

  return (
    <SpotlightCard color={HP} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-extrabold tracking-tight">{inv.label}</h2>
            {inv.extraction === 'partielle' ? (
              <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300">À vérifier</Badge>
            ) : inv.extraction === 'manuelle' ? (
              <Badge variant="outline">Saisie manuelle</Badge>
            ) : (
              <Badge variant="outline">Lue automatiquement</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Du {day(inv.periodStart)} au {day(inv.periodEnd)} ({a.days} jours){inv.supplier ? ` · ${inv.supplier}` : ''}
          </p>
        </div>
        <div className="flex gap-1">
          {a.fileUrl && (
            <Button asChild variant="ghost" size="icon-sm" aria-label="Ouvrir le PDF original" title="PDF original">
              <a href={a.fileUrl} target="_blank" rel="noreferrer">
                <FileText />
              </a>
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label="Corriger la facture" title="Corriger">
            <PencilLine />
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Supprimer ${inv.label}`} title="Supprimer">
                <Trash2 />
              </Button>
            }
            title={`Supprimer « ${inv.label} » ?`}
            description="La facture, son PDF et son analyse seront définitivement supprimés."
            onConfirm={async () => {
              try {
                await del.mutateAsync(inv.id)
                toast.success('Facture supprimée')
                onDeleted()
              } catch (e) {
                toast.error(apiErrorMessage(e))
              }
            }}
          />
        </div>
      </div>

      {a.missing.length > 0 && (
        <div role="alert" className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-orange-500/12 px-4 py-3 text-sm text-orange-800 dark:text-orange-200">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span className="flex-1">Non trouvé dans le PDF : {a.missing.map((m) => MISSING_LABEL[m] ?? m).join(', ')}. Les valeurs affichées sont provisoires.</span>
          <Button size="sm" variant="outline" onClick={onEdit}>
            Corriger
          </Button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Montant TTC" value={<AnimatedNumber value={inv.amount} format={(n) => eur(n)} />} />
        <Kpi label="Consommation" value={<AnimatedNumber value={inv.kwh} format={(n) => `${formatNumber(n)} kWh`} />} />
        <Kpi label="Prix moyen" value={`${formatNumber(a.pricePerKwh, 3)} €`} sub="par kWh" />
        <Kpi
          label="Par jour"
          value={`${formatNumber(a.kwhPerDay, 1)} kWh`}
          sub={
            change === null ? (
              'première facture'
            ) : (
              <span className={cn('inline-flex items-center gap-0.5 font-semibold', change > 0 ? 'text-red-600 dark:text-red-400' : 'text-leaf-fg')}>
                {change > 0 ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : <ArrowDownRight className="size-3.5" aria-hidden="true" />}
                {change > 0 ? '+' : ''}
                {formatNumber(change, 0)} % vs précédente
              </span>
            )
          }
        />
      </div>

      {/* Décomposition du montant */}
      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold">Où va votre argent</h3>
        <div className="flex h-4 overflow-hidden rounded-full" role="img" aria-label={a.tiers.map((t) => `${t.label} ${eur(t.amount)}`).join(', ')}>
          {a.tiers
            .filter((t) => t.amount > 0)
            .map((t, i) => (
              <motion.div
                key={t.label}
                className="h-full border-r-2 border-card last:border-r-0"
                style={{ backgroundColor: TIER_COLOR(t.label) }}
                initial={{ width: 0 }}
                animate={{ width: `${(t.amount / inv.amount) * 100}%` }}
                transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            ))}
        </div>
        <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {a.tiers.map((t) => (
            <li key={t.label} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: TIER_COLOR(t.label) }} aria-hidden="true" />
              <span className="flex-1 truncate text-muted-foreground">
                {t.label}
                {t.kwh !== null && ` · ${formatNumber(t.kwh)} kWh`}
              </span>
              <span className="tabular font-semibold">{eur(t.amount)}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Explication IA */}
      <div className="mt-6 space-y-3 rounded-2xl border bg-background/50 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-energy-fg" aria-hidden="true" /> Votre facture expliquée
          </h3>
          <ListenButton text={`${inv.explanation} ${inv.tips.join(' ')}`} />
        </div>
        <p className="text-sm leading-relaxed">{inv.explanation}</p>
        <ul className="space-y-1.5">
          {inv.tips.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-muted-foreground">
              <Zap className="mt-0.5 size-4 shrink-0 text-energy-fg" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </SpotlightCard>
  )
}

function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-background/50 p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-lg font-extrabold tracking-tight sm:text-xl">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─────────────────────────── Graphique ───────────────────────────

function ConsumptionChart({ invoices, selectedId, onSelect }: { invoices: Invoice[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const data = invoices.map((i) => ({
    id: i.id,
    label: month(i.periodEnd),
    hp: i.hpKwh ?? i.kwh,
    hc: i.hcKwh ?? 0,
    amount: i.amount,
    title: i.label,
  }))
  return (
    <figure className="space-y-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-lg font-bold">Évolution de la consommation</span>
        <span className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: HP }} aria-hidden="true" /> Heures pleines
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: HC }} aria-hidden="true" /> Heures creuses
          </span>
        </span>
      </figcaption>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -8 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tickLine={false} axisLine={false} width={42} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ChartTooltip />} />
            {(['hp', 'hc'] as const).map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="kwh"
                fill={key === 'hp' ? HP : HC}
                radius={key === 'hc' ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                maxBarSize={34}
                onClick={(d) => onSelect((d as unknown as { id: string }).id)}
                className="cursor-pointer"
              >
                {data.map((d) => (
                  <Cell key={d.id} fillOpacity={!selectedId || d.id === selectedId ? 1 : 0.35} stroke="var(--card)" strokeWidth={key === 'hc' ? 2 : 0} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground">Cliquez sur un mois pour afficher sa facture.</p>
    </figure>
  )
}

function ChartTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as { title: string; hp: number; hc: number; amount: number }
  return (
    <div className="space-y-1 rounded-xl border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-float)]">
      <p className="font-semibold">{d.title}</p>
      <p className="tabular">
        <span className="mr-1.5 inline-block size-2 rounded-[2px]" style={{ backgroundColor: HP }} aria-hidden="true" />
        Heures pleines : {formatNumber(d.hp)} kWh
      </p>
      {d.hc > 0 && (
        <p className="tabular">
          <span className="mr-1.5 inline-block size-2 rounded-[2px]" style={{ backgroundColor: HC }} aria-hidden="true" />
          Heures creuses : {formatNumber(d.hc)} kWh
        </p>
      )}
      <p className="tabular font-semibold">{eur(d.amount)}</p>
    </div>
  )
}

// ─────────────────────────── Simulateur ───────────────────────────

function Simulator({ invoice }: { invoice: Invoice | null }) {
  const tariffs = useTariffs()
  const [input, setInput] = useState<SimulatorInput>(DEFAULT_SIMULATION)
  const set = (patch: Partial<SimulatorInput>) => setInput((i) => ({ ...i, ...patch }))
  const result = useMemo(
    () =>
      tariffs.data
        ? simulateSavings(tariffs.data, input, {
            yearlyCost: invoice?.analysis.projectedYearlyCost ?? 1200,
            pricePerKwh: invoice?.analysis.pricePerKwh ?? tariffs.data.baseKwh,
          })
        : null,
    [tariffs.data, input, invoice],
  )
  const max = Math.max(...(result?.lines.map((l) => l.eur) ?? [1]), 1)

  return (
    <SpotlightCard color={HP} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Simulateur d’économies</h2>
          <p className="text-sm text-muted-foreground">Bougez les curseurs : l’économie se calcule avec les tarifs de votre facture.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Économie estimée</p>
          <p className="text-4xl font-extrabold tracking-[-0.04em] text-energy-fg">
            <AnimatedNumber value={result?.total ?? 0} format={(n) => `${formatNumber(n)}\u00a0€`} />
          </p>
          <p className="text-xs text-muted-foreground">par an</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <SimSlider id="sim-wash" label="Lave-linge lancés la nuit" unit="cycles / semaine" value={input.washingShifted} max={7} onChange={(v) => set({ washingShifted: v })} />
        <SimSlider id="sim-dish" label="Lave-vaisselle lancés la nuit" unit="cycles / semaine" value={input.dishwasherShifted} max={7} onChange={(v) => set({ dishwasherShifted: v })} />
        <SimSlider id="sim-temp" label="Baisser le chauffage" unit="°C" value={input.thermostatDown} max={3} onChange={(v) => set({ thermostatDown: v })} disabled={!input.electricHeating} />
        <SimSlider id="sim-led" label="Ampoules remplacées par des LED" unit="ampoules" value={input.ledBulbs} max={20} onChange={(v) => set({ ledBulbs: v })} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Toggle checked={input.waterHeaterNight} onChange={(v) => set({ waterHeaterNight: v })}>
          Chauffe-eau programmé la nuit
        </Toggle>
        <Toggle checked={input.electricHeating} onChange={(v) => set({ electricHeating: v })}>
          Logement chauffé à l’électricité
        </Toggle>
      </div>

      {result && (
        <ul className="mt-6 space-y-2">
          {result.lines.map((l) => (
            <li key={l.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="tabular font-semibold">{formatNumber(l.eur)} €</span>
              <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full rounded-full bg-energy" animate={{ width: `${(l.eur / max) * 100}%` }} transition={{ duration: 0.4 }} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {invoice?.offer === 'base' && (
        <p className="mt-4 rounded-xl bg-energy/10 px-3 py-2 text-xs text-energy-fg">
          Votre facture est en option Base : les gains « la nuit » supposent de passer à l’option Heures pleines / Heures creuses.
        </p>
      )}
      {result && result.kwhSaved > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Soit {formatNumber(result.kwhSaved)} kWh économisés et environ {formatNumber(result.co2Kg)} kg de CO₂ évités par an. Estimation indicative.
        </p>
      )}
    </SpotlightCard>
  )
}

function SimSlider({ id, label, unit, value, max, onChange, disabled }: { id: string; label: string; unit: string; value: number; max: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className={cn('space-y-2.5', disabled && 'opacity-50')}>
      <div className="flex items-baseline justify-between gap-2">
        <Label id={id} className="text-sm">
          {label}
        </Label>
        <span className="tabular shrink-0 text-sm font-bold">
          {value} <span className="font-normal text-muted-foreground">{unit}</span>
        </span>
      </div>
      <Slider aria-labelledby={id} min={0} max={max} step={1} value={[value]} onValueChange={([v]) => onChange(v)} disabled={disabled} />
    </div>
  )
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('flex h-10 items-center gap-2.5 rounded-xl border px-3 text-sm font-medium transition-colors', checked ? 'border-energy/50 bg-energy/10' : 'bg-background/50 text-muted-foreground')}
    >
      <span className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-energy' : 'bg-muted-foreground/30')} aria-hidden="true">
        <span className={cn('absolute top-0.5 size-4 rounded-full bg-white shadow transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {children}
    </button>
  )
}

// ─────────────────────────── Historique ───────────────────────────

function HistoryList({ invoices, selectedId, onSelect }: { invoices: Invoice[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <SpotlightCard color={HP} className="p-5 sm:p-6">
      <h2 className="mb-3 text-lg font-bold">Mes factures</h2>
      <ul className="-mx-2 max-h-[26rem] space-y-1 overflow-y-auto px-2">
        {[...invoices].reverse().map((i) => (
          <li key={i.id}>
            <button
              onClick={() => onSelect(i.id)}
              aria-current={i.id === selectedId}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                i.id === selectedId ? 'bg-energy/10 ring-1 ring-energy/30' : 'hover:bg-muted',
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-energy/12 text-energy-fg">
                <Receipt className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{i.label}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatNumber(i.kwh)} kWh{i.extraction === 'partielle' ? ' · à vérifier' : ''}
                </span>
              </span>
              <span className="tabular text-sm font-bold">{eur(i.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </SpotlightCard>
  )
}

// ─────────────────────────── Saisie / correction ───────────────────────────

const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '')

function InvoiceFormDialog({ open, invoice, onClose, onSaved }: { open: boolean; invoice: Invoice | null; onClose: () => void; onSaved: (i: Invoice) => void }) {
  const save = useSaveInvoice()
  const [v, setV] = useState({ label: '', supplier: '', periodStart: '', periodEnd: '', kwh: '', hpKwh: '', hcKwh: '', amount: '', kva: '6' })
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!open) return
    setSubmitted(false)
    setV({
      label: invoice?.label ?? '',
      supplier: invoice?.supplier ?? '',
      periodStart: toDateInput(invoice?.periodStart),
      periodEnd: toDateInput(invoice?.periodEnd),
      kwh: invoice ? String(invoice.kwh) : '',
      hpKwh: invoice?.hpKwh != null ? String(invoice.hpKwh) : '',
      hcKwh: invoice?.hcKwh != null ? String(invoice.hcKwh) : '',
      amount: invoice ? String(invoice.amount) : '',
      kva: String(invoice?.subscriptionKva ?? 6),
    })
  }, [open, invoice])

  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
  const errors: Partial<Record<keyof typeof v, string>> = {}
  if (!v.periodStart) errors.periodStart = 'Indiquez la date de début.'
  if (!v.periodEnd) errors.periodEnd = 'Indiquez la date de fin.'
  else if (v.periodStart && v.periodEnd <= v.periodStart) errors.periodEnd = 'La fin doit être après le début.'
  if (!num(v.kwh) || num(v.kwh)! < 1) errors.kwh = 'Consommation en kWh (au moins 1).'
  if (!num(v.amount) || num(v.amount)! < 1) errors.amount = 'Montant TTC en € (au moins 1).'
  const hp = num(v.hpKwh)
  const hc = num(v.hcKwh)
  if ((hp === null) !== (hc === null)) errors.hcKwh = 'Renseignez les heures pleines ET creuses, ou aucune des deux.'
  else if (hp !== null && hc !== null && num(v.kwh) && Math.abs(hp + hc - num(v.kwh)!) > Math.max(2, num(v.kwh)! * 0.02))
    errors.hcKwh = `HP + HC = ${hp + hc} kWh, mais la consommation totale est ${v.kwh} kWh.`
  const missing = new Set(invoice?.analysis.missing ?? [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length) return
    const input: InvoiceInput & { id?: string } = {
      id: invoice?.id,
      ...(v.label.trim() ? { label: v.label.trim() } : {}),
      supplier: v.supplier.trim(),
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      kwh: num(v.kwh)!,
      hpKwh: hp,
      hcKwh: hc,
      amount: num(v.amount)!,
      subscriptionKva: Number(v.kva),
    }
    try {
      const saved = await save.mutateAsync(input)
      toast.success(invoice ? 'Facture corrigée' : 'Facture ajoutée', { description: saved.label })
      onSaved(saved)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const field = (key: keyof typeof v, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`inv-${key}`} className="flex items-center gap-1.5">
        {label}
        {missing.has(key) && <span className="rounded bg-orange-500/15 px-1.5 text-[0.65rem] font-semibold text-orange-700 dark:text-orange-300">à vérifier</span>}
      </Label>
      <input
        id={`inv-${key}`}
        value={v[key]}
        onChange={(e) => setV((s) => ({ ...s, [key]: e.target.value }))}
        aria-invalid={submitted && Boolean(errors[key])}
        aria-describedby={submitted && errors[key] ? `inv-${key}-err` : undefined}
        className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
        {...props}
      />
      {submitted && errors[key] && (
        <p id={`inv-${key}-err`} className="text-xs text-destructive">
          {errors[key]}
        </p>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} noValidate className="space-y-5">
          <DialogHeader>
            <DialogTitle>{invoice ? 'Corriger la facture' : 'Saisir une facture'}</DialogTitle>
            <DialogDescription>Les montants et l’explication sont recalculés dès l’enregistrement.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {field('label', 'Nom (facultatif)', { placeholder: 'Facture de novembre' })}
            {field('supplier', 'Fournisseur (facultatif)')}
            {field('periodStart', 'Début de période', { type: 'date' })}
            {field('periodEnd', 'Fin de période', { type: 'date' })}
            {field('kwh', 'Consommation totale (kWh)', { inputMode: 'decimal' })}
            {field('amount', 'Montant TTC (€)', { inputMode: 'decimal' })}
            {field('hpKwh', 'Heures pleines (kWh)', { inputMode: 'decimal', placeholder: 'si option HP/HC' })}
            {field('hcKwh', 'Heures creuses (kWh)', { inputMode: 'decimal', placeholder: 'si option HP/HC' })}
            <div className="space-y-1.5">
              <Label htmlFor="inv-kva">Puissance souscrite</Label>
              <select id="inv-kva" value={v.kva} onChange={(e) => setV((s) => ({ ...s, kva: e.target.value }))} className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30">
                {[3, 6, 9, 12].map((k) => (
                  <option key={k} value={k}>
                    {k} kVA
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
              Annuler
            </Button>
            <Button type="submit" variant="module" disabled={save.isPending}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {invoice ? 'Enregistrer la correction' : 'Ajouter la facture'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
