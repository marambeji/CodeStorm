import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, FlaskConical, Gauge, Loader2, MoreHorizontal, PencilLine, Plus, ScanLine, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Bar, Cell, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAddReading,
  useDeleteMeter,
  useDeleteReading,
  useMeterHistory,
  useMeters,
  useSaveMeter,
  useUpdateReading,
  type MeterHistory,
  type Reading,
} from '@/features/aquascan/api'
import { readMeterImage, sampleMeterPhoto } from '@/features/aquascan/ocr'
import { ListenButton } from '@/features/plantdoc/components'
import { apiErrorMessage } from '@/features/terracalc/api'
import { formatNumber } from '@/features/terracalc/geo'
import { MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils'

const MODULE = MODULES.find((m) => m.id === 'aquascan')!
const WATER = '#0EA5E9'
const LEAK = '#EF4444'
const nowLocal = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** AquaScan : relevé du compteur par photo (OCR), historique et détection de fuite */
export default function AquaScanPage() {
  const { t } = useTranslation()
  const meters = useMeters()
  const [meterId, setMeterId] = useState<string | null>(null)
  const [meterDialog, setMeterDialog] = useState<{ open: boolean; edit: boolean }>({ open: false, edit: false })
  const current = meters.data?.find((m) => m.id === meterId) ?? meters.data?.[0] ?? null
  const history = useMeterHistory(current?.id ?? null)
  const delMeter = useDeleteMeter()

  return (
    <>
      <PageHeader
        title={MODULE.name}
        description={t('modules.aquascan.description')} icon={MODULE.icon}
        tone="water"
        meta={<Badge variant="outline">{t('themes.eau')}</Badge>}
      />

      {/* Compteurs */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Compteurs" className="flex flex-wrap gap-2">
          {meters.data?.map((m) => (
            <button
              key={m.id}
              role="tab"
              aria-selected={m.id === current?.id}
              onClick={() => setMeterId(m.id)}
              className={cn(
                'flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors',
                m.id === current?.id ? 'border-transparent bg-foreground text-background' : 'bg-background/50 text-muted-foreground hover:text-foreground',
              )}
            >
              <Gauge className="size-4" aria-hidden="true" />
              {m.name}
              {m.leakAlert && (
                <span className="relative flex size-2" title="Fuite possible">
                  <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-70" />
                  <span className="relative size-2 rounded-full bg-red-500" />
                  <span className="sr-only">(fuite possible)</span>
                </span>
              )}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setMeterDialog({ open: true, edit: false })}>
          <Plus aria-hidden="true" /> Compteur
        </Button>
        {current && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Options du compteur ${current.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setMeterDialog({ open: true, edit: true })}>
                <PencilLine /> Renommer
              </DropdownMenuItem>
              <ConfirmDialog
                trigger={
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                    <Trash2 /> Supprimer
                  </DropdownMenuItem>
                }
                title={`Supprimer « ${current.name} » ?`}
                description={`Le compteur et ses ${current.readings} relevés seront définitivement supprimés.`}
                onConfirm={async () => {
                  try {
                    await delMeter.mutateAsync(current.id)
                    setMeterId(null)
                    toast.success('Compteur supprimé')
                  } catch (e) {
                    toast.error(apiErrorMessage(e))
                  }
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {meters.isPending && <Skeleton className="h-96 rounded-3xl" />}
      {meters.isError && <EmptyState icon={Gauge} title="Compteurs indisponibles" description={apiErrorMessage(meters.error)} />}
      {meters.data?.length === 0 && (
        <EmptyState
          icon={Gauge}
          title="Aucun compteur"
          description="Ajoutez votre compteur d’eau pour commencer à suivre votre consommation."
          action={
            <Button variant="module" onClick={() => setMeterDialog({ open: true, edit: false })}>
              <Plus aria-hidden="true" /> Ajouter un compteur
            </Button>
          }
        />
      )}

      {current && (
        <>
          {history.data && <StatusBanner history={history.data} />}
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <NewReadingCard key={current.id} meterId={current.id} lastIndex={current.lastIndex} />
            <SpotlightCard color={WATER} className="p-5 sm:p-6">
              {history.data ? <ConsumptionView history={history.data} /> : <Skeleton className="h-80" />}
            </SpotlightCard>
          </div>
          {history.data && <ReadingsTable history={history.data} />}
        </>
      )}

      <MeterDialog
        open={meterDialog.open}
        meter={meterDialog.edit ? current : null}
        onClose={() => setMeterDialog({ open: false, edit: false })}
        onCreated={(id) => setMeterId(id)}
      />
    </>
  )
}

// ─────────────────────────── Bannière d'état ───────────────────────────

function StatusBanner({ history: h }: { history: MeterHistory }) {
  const leak = h.stats.leakAlert
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      role={leak ? 'alert' : 'status'}
      className={cn(
        'relative overflow-hidden rounded-3xl border p-5',
        leak ? 'border-red-500/40 bg-gradient-to-br from-red-500/18 via-red-500/8 to-transparent' : 'border-leaf/30 bg-gradient-to-br from-leaf/12 to-transparent',
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <span className={cn('relative flex size-12 shrink-0 items-center justify-center rounded-2xl', leak ? 'bg-red-500/20 text-red-500' : 'bg-leaf/15 text-leaf-fg')}>
          {leak && <span className="absolute inset-0 animate-ping rounded-2xl bg-red-500/25" aria-hidden="true" />}
          {leak ? <AlertTriangle className="relative size-6" aria-hidden="true" /> : <CheckCircle2 className="size-6" aria-hidden="true" />}
        </span>
        <div className="order-3 min-w-0 basis-full space-y-1 sm:order-none sm:basis-0 sm:flex-1">
          <p className={cn('text-lg font-extrabold', leak ? 'text-red-600 dark:text-red-400' : 'text-leaf-fg')}>{leak ? 'Fuite possible détectée' : 'Consommation normale'}</p>
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/85">{h.advice}</p>
        </div>
        <div className="ml-auto sm:ml-0">
          <ListenButton text={h.advice} />
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────── Nouveau relevé ───────────────────────────

function NewReadingCard({ meterId, lastIndex }: { meterId: string; lastIndex: number | null }) {
  const add = useAddReading()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocr, setOcr] = useState<{ running: boolean; progress: number; confidence: number | null; raw: string }>({ running: false, progress: 0, confidence: null, raw: '' })
  const [value, setValue] = useState('')
  const [readAt, setReadAt] = useState(nowLocal())
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function pick(f: File | null) {
    setFile(f)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
    setOcr({ running: false, progress: 0, confidence: null, raw: '' })
    if (!f) return
    setOcr((o) => ({ ...o, running: true }))
    try {
      const r = await readMeterImage(f, (p) => setOcr((o) => ({ ...o, progress: p })))
      setOcr({ running: false, progress: 1, confidence: r.confidence, raw: r.raw })
      if (r.value !== null) {
        setValue(String(r.value).replace('.', ','))
        toast.success('Compteur lu', { description: `${formatNumber(r.value, 3)} m³ · vérifiez la valeur avant d’enregistrer` })
      } else toast.warning('Chiffres illisibles : saisissez la valeur à la main.')
    } catch {
      setOcr({ running: false, progress: 0, confidence: null, raw: '' })
      toast.error('Lecture automatique indisponible (connexion nécessaire la première fois). Saisissez la valeur à la main.')
    }
  }

  const num = Number(value.replace(',', '.').replace(/\s/g, ''))
  const error =
    value.trim() === '' || Number.isNaN(num) ? 'Indiquez l’index du compteur en m³ (ex : 1278,596).' : lastIndex !== null && num < lastIndex ? `L’index ne peut pas être inférieur au dernier relevé (${formatNumber(lastIndex, 3)} m³).` : null

  // Écart très inhabituel avec le dernier relevé : probablement une erreur de lecture
  const suspicious = !error && lastIndex !== null && num - lastIndex > 50

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (error || !readAt) return
    try {
      await add.mutateAsync({
        meterId,
        value: num,
        readAt: new Date(readAt).toISOString(),
        source: ocr.confidence !== null ? 'ocr' : 'manuel',
        // Une confiance nulle signifie "non fournie par Tesseract" : on ne l'enregistre pas
        ocrConfidence: ocr.confidence ? ocr.confidence : undefined,
        note: note.trim() || undefined,
        photo: file,
      })
      toast.success('Relevé enregistré')
      pick(null)
      setValue('')
      setNote('')
      setSubmitted(false)
      setReadAt(nowLocal())
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <SpotlightCard color={WATER} className="p-5 sm:p-6">
      <h2 className="mb-4 text-lg font-bold">Nouveau relevé</h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <AnimatePresence mode="wait" initial={false}>
          {preview ? (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative overflow-hidden rounded-2xl">
              <img src={preview} alt="Photo du compteur" className="aspect-[16/10] w-full object-cover" />
              {ocr.running && (
                <>
                  <div className="absolute inset-0 bg-water/15" />
                  <div className="animate-scan absolute inset-x-0 h-1 bg-water shadow-[0_0_24px_6px_rgb(14_165_233/0.6)]" />
                  <p className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-black/60 px-3 py-2 text-xs font-medium text-white backdrop-blur">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Lecture des chiffres… {Math.round(ocr.progress * 100)} %
                  </p>
                </>
              )}
              <Button type="button" size="sm" variant="outline" className="absolute top-3 right-3 bg-background/80" onClick={() => pick(null)}>
                Changer
              </Button>
            </motion.div>
          ) : (
            <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DropZone accept="image/*" label="Photo du compteur" hint="Cadrez les chiffres, sans reflet" camera file={null} onFile={pick} />
            </motion.div>
          )}
        </AnimatePresence>
        {!preview && (
          <Button type="button" variant="ghost" size="sm" onClick={async () => pick(await sampleMeterPhoto((lastIndex ?? 1200) + 1.8 + Math.random() * 0.6))}>
            <FlaskConical aria-hidden="true" /> Photo de compteur d’exemple
          </Button>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="aq-value">Index du compteur (m³)</Label>
            {ocr.confidence !== null && (
              <span className="flex items-center gap-1 text-xs font-semibold text-water-fg">
                <ScanLine className="size-3.5" aria-hidden="true" /> {ocr.confidence > 0 ? `lu à ${Math.round(ocr.confidence * 100)} %` : 'lu automatiquement'}
              </span>
            )}
          </div>
          <input
            id="aq-value"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={lastIndex !== null ? `supérieur à ${formatNumber(lastIndex, 3)}` : '1278,596'}
            aria-invalid={submitted && Boolean(error)}
            aria-describedby={submitted && error ? 'aq-value-err' : 'aq-value-hint'}
            className="tabular h-14 w-full rounded-xl border border-input bg-transparent px-4 text-2xl font-extrabold tracking-wide outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
          />
          {submitted && error ? (
            <p id="aq-value-err" className="text-sm text-destructive">
              {error}
            </p>
          ) : suspicious ? (
            <p id="aq-value-hint" role="alert" className="text-sm font-medium text-orange-600 dark:text-orange-400">
              +{formatNumber(num - (lastIndex ?? 0), 1)} m³ depuis le dernier relevé : c’est beaucoup. Vérifiez la lecture avant d’enregistrer.
            </p>
          ) : (
            <p id="aq-value-hint" className="text-xs text-muted-foreground">
              Lue automatiquement depuis la photo, ou saisie à la main. Corrigez-la si besoin.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="aq-date">Date du relevé</Label>
            <input id="aq-date" type="datetime-local" max={nowLocal()} value={readAt} onChange={(e) => setReadAt(e.target.value)} className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm dark:bg-input/30" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aq-note">Note (facultatif)</Label>
            <input id="aq-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex : après vacances" className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm dark:bg-input/30" />
          </div>
        </div>
        <Button type="submit" size="lg" variant="module" className="w-full" disabled={add.isPending || ocr.running}>
          {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Enregistrer le relevé
        </Button>
      </form>
    </SpotlightCard>
  )
}

// ─────────────────────────── Consommation ───────────────────────────

function ConsumptionView({ history: h }: { history: MeterHistory }) {
  const s = h.stats
  const data = h.periods.map((p) => ({
    label: new Date(p.to).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }),
    liters: p.litersPerDay,
    baseline: p.baseline,
    anomaly: p.anomaly,
    days: p.days,
    m3: p.m3,
  }))
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Dernier index" value={s.lastIndex !== null ? <AnimatedNumber value={s.lastIndex} format={(n) => `${formatNumber(n, 1)} m³`} /> : '–'} />
        <Kpi label="Habituel" value={s.usualLitersPerDay !== null ? `${formatNumber(s.usualLitersPerDay)} L/j` : '–'} />
        <Kpi
          label="Dernière période"
          value={s.lastLitersPerDay !== null ? `${formatNumber(s.lastLitersPerDay)} L/j` : '–'}
          tone={s.leakAlert ? 'leak' : undefined}
        />
        <Kpi label="Relevés" value={String(s.readings)} />
      </div>
      <figure className="space-y-2">
        <figcaption className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold">Consommation par jour entre deux relevés</span>
          <span className="flex gap-3 text-[0.7rem] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: WATER }} aria-hidden="true" /> Normale
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: LEAK }} aria-hidden="true" /> Anormale
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 border-t-2 border-dashed border-foreground/50" aria-hidden="true" /> Habituelle
            </span>
          </span>
        </figcaption>
        {data.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} unit=" L" />
                <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.5 }} content={<ConsoTooltip />} />
                <Bar dataKey="liters" radius={[4, 4, 0, 0]} maxBarSize={30}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.anomaly ? LEAK : WATER} />
                  ))}
                </Bar>
                <Line dataKey="baseline" type="stepAfter" stroke="var(--foreground)" strokeOpacity={0.5} strokeDasharray="5 4" strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">Ajoutez un deuxième relevé pour voir votre consommation.</p>
        )}
      </figure>
      <p className="text-xs text-muted-foreground">
        Alerte « fuite possible » si la consommation dépasse {h.rule.ratio}× l’habitude et d’au moins {h.rule.minExcessLitersPerDay} L par jour.
      </p>
    </div>
  )
}

function ConsoTooltip({ active, payload }: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload as { label: string; liters: number; baseline: number | null; anomaly: boolean; days: number; m3: number }
  return (
    <div className="space-y-0.5 rounded-xl border bg-popover px-3 py-2 text-xs shadow-[var(--shadow-float)]">
      <p className="font-semibold">Jusqu’au {d.label}</p>
      <p className="tabular">
        {formatNumber(d.liters)} L/jour ({formatNumber(d.m3, 2)} m³ en {formatNumber(d.days, 1)} j)
      </p>
      {d.baseline !== null && <p className="tabular text-muted-foreground">Habituel : {formatNumber(d.baseline)} L/jour</p>}
      {d.anomaly && <p className="font-semibold text-red-500">Consommation anormale</p>}
    </div>
  )
}

function Kpi({ label, value, tone }: { label: string; value: ReactNode; tone?: 'leak' }) {
  return (
    <div className={cn('rounded-2xl border bg-background/50 p-3.5', tone === 'leak' && 'border-red-500/40 bg-red-500/8')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('tabular mt-1 text-lg font-extrabold', tone === 'leak' && 'text-red-600 dark:text-red-400')}>{value}</p>
    </div>
  )
}

// ─────────────────────────── Relevés ───────────────────────────

function ReadingsTable({ history: h }: { history: MeterHistory }) {
  const del = useDeleteReading()
  const [editing, setEditing] = useState<Reading | null>(null)
  const byReading = useMemo(() => new Map(h.periods.map((p) => [p.toReadingId, p])), [h.periods])
  const rows = [...h.readings].reverse()

  return (
    <SpotlightCard color={WATER} className="mt-5 p-5 sm:p-6">
      <h2 className="mb-3 text-lg font-bold">Relevés</h2>
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Date</th>
              <th className="px-2 py-2 font-medium">Index</th>
              <th className="px-2 py-2 font-medium">Depuis le précédent</th>
              <th className="px-2 py-2 font-medium">Source</th>
              <th className="px-2 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const p = byReading.get(r.id)
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-2 py-2.5 whitespace-nowrap">{new Date(r.readAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="tabular px-2 py-2.5 font-semibold">{formatNumber(r.value, 3)} m³</td>
                  <td className="tabular px-2 py-2.5">
                    {p ? (
                      <span className={cn(p.anomaly && 'font-semibold text-red-600 dark:text-red-400')}>
                        {formatNumber(p.litersPerDay)} L/j{p.anomaly && ' · anormal'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">premier relevé</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <Badge variant="outline">{r.source === 'ocr' ? `Photo${r.ocrConfidence ? ` · ${Math.round(r.ocrConfidence * 100)} %` : ''}` : 'Manuel'}</Badge>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex justify-end gap-0.5">
                      <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label="Corriger le relevé">
                        <PencilLine />
                      </Button>
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label="Supprimer le relevé">
                            <Trash2 />
                          </Button>
                        }
                        title="Supprimer ce relevé ?"
                        description={`Le relevé de ${formatNumber(r.value, 3)} m³ du ${new Date(r.readAt).toLocaleDateString('fr-FR')} sera supprimé et la consommation recalculée.`}
                        onConfirm={async () => {
                          try {
                            await del.mutateAsync(r.id)
                            toast.success('Relevé supprimé')
                          } catch (e) {
                            toast.error(apiErrorMessage(e))
                          }
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <EditReadingDialog reading={editing} onClose={() => setEditing(null)} />
    </SpotlightCard>
  )
}

function EditReadingDialog({ reading, onClose }: { reading: Reading | null; onClose: () => void }) {
  const update = useUpdateReading()
  const [value, setValue] = useState('')
  const [readAt, setReadAt] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!reading) return
    setValue(String(reading.value).replace('.', ','))
    setReadAt(toLocalInput(reading.readAt))
    setNote(reading.note ?? '')
  }, [reading])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!reading) return
    const num = Number(value.replace(',', '.'))
    if (Number.isNaN(num) || value.trim() === '') return toast.error('L’index doit être un nombre.')
    try {
      await update.mutateAsync({ id: reading.id, value: num, readAt: new Date(readAt).toISOString(), note: note.trim() })
      toast.success('Relevé corrigé')
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={Boolean(reading)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Corriger le relevé</DialogTitle>
            <DialogDescription>La consommation et la détection de fuite sont recalculées automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ed-value">Index (m³)</Label>
            <input id="ed-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="tabular h-10 w-full rounded-lg border bg-transparent px-3 dark:bg-input/30" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-date">Date</Label>
            <input id="ed-date" type="datetime-local" max={nowLocal()} value={readAt} onChange={(e) => setReadAt(e.target.value)} className="h-10 w-full rounded-lg border bg-transparent px-3 dark:bg-input/30" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-note">Note</Label>
            <input id="ed-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="h-10 w-full rounded-lg border bg-transparent px-3 dark:bg-input/30" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="module" disabled={update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MeterDialog({ open, meter, onClose, onCreated }: { open: boolean; meter: { id: string; name: string; location: string | null } | null; onClose: () => void; onCreated: (id: string) => void }) {
  const save = useSaveMeter()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  useEffect(() => {
    if (!open) return
    setName(meter?.name ?? '')
    setLocation(meter?.location ?? '')
    setSubmitted(false)
  }, [open, meter])
  const error = name.trim().length < 2 ? 'Donnez un nom d’au moins 2 caractères, par exemple « Compteur maison ».' : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    setSubmitted(true)
    if (error) return
    try {
      const r = (await save.mutateAsync({ id: meter?.id, name: name.trim(), location: location.trim() })) as { id: string }
      toast.success(meter ? 'Compteur renommé' : 'Compteur ajouté')
      if (!meter) onCreated(r.id)
      onClose()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle>{meter ? 'Renommer le compteur' : 'Ajouter un compteur'}</DialogTitle>
            <DialogDescription>Un compteur par point de comptage : maison, jardin, exploitation…</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mt-name">Nom</Label>
            <input id="mt-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-invalid={submitted && Boolean(error)} className="h-10 w-full rounded-lg border bg-transparent px-3 aria-invalid:border-destructive dark:bg-input/30" />
            {submitted && error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mt-loc">Emplacement (facultatif)</Label>
            <input id="mt-loc" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={60} className="h-10 w-full rounded-lg border bg-transparent px-3 dark:bg-input/30" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="module" disabled={save.isPending}>
              {meter ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
