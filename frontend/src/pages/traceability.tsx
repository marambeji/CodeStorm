import { AlertOctagon, AlertTriangle, BrainCircuit, Crosshair, ExternalLink, Gauge, Lightbulb, Link2, Loader2, MapPin, PackagePlus, Plus, QrCode, Route as RouteIcon, ScanLine, Sprout, Trash2, TrendingDown, TrendingUp, Truck } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe, useRole } from '@/features/auth/auth'
import { CATEGORIES, categoryLabel, formatDate, formatQty, UNITS } from '@/features/market/api'
import { PillTabs, StatTile } from '@/features/market/components'
import { DeliveryMap, LocationPicker, type MapStop } from '@/features/market/live-map'
import { route as roadRoute, formatDuration, type Point } from '@/features/market/routing'
import { apiErrorMessage } from '@/features/terracalc/api'
import {
  ACTOR_ROLES,
  publicLotUrl,
  STAGES,
  stageLabel,
  useAddStep,
  useCreateLot,
  useInsights,
  useLot,
  useMyLots,
  useOpenLots,
  useOptimizeRoute,
  type ActorRole,
  type HarvestLot,
  type OptimizedRoute,
  type Recommendation,
  type StepInput,
} from '@/features/trace/api'
import { CertifiedMini, FreshnessGauge, LotPassport, LotQrCode, QrScannerDialog, StagePill } from '@/features/trace/components'
import { cn } from '@/lib/utils'

type Tab = 'lots' | 'etape' | 'itineraire' | 'ia'

/**
 * Traçabilité de la ferme au consommateur :
 * Agriculteur → Collecteur → Transporteur → Distributeur → Consommateur, avec un registre
 * chaîné (style blockchain) et l'IA (conservation, demande, pertes).
 */
export default function TraceabilityPage() {
  const role = useRole()
  const [tab, setTab] = useState<Tab>(role === 'agriculteur' ? 'lots' : 'etape')
  const [pending, setPending] = useState<string | null>(null)

  return (
    <>
      <PageHeader
        title="Traçabilité"
        description="Chaque lot récolté reçoit un identifiant unique et un QR code. Chaque acteur de la chaîne ajoute son étape dans un registre infalsifiable ; le consommateur scanne et voit tout."
        icon={Link2}
        tone="leaf"
        actions={
          <Button asChild variant="outline">
            <Link to="/trace" target="_blank">
              <ScanLine aria-hidden="true" /> Vue consommateur
            </Link>
          </Button>
        }
      />

      <SupplyChainStrip />

      <PillTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'lots', label: role === 'agriculteur' ? 'Mes récoltes' : 'Mes lots' },
          { id: 'etape', label: 'Enregistrer une étape' },
          { id: 'itineraire', label: 'Itinéraires' },
          { id: 'ia', label: 'IA & pertes' },
        ]}
      />

      {tab === 'lots' && (
        <LotsTab
          onStep={(code) => {
            setPending(code)
            setTab('etape')
          }}
        />
      )}
      {tab === 'etape' && <StepTab initialCode={pending} />}
      {tab === 'itineraire' && <RouteTab />}
      {tab === 'ia' && <InsightsTab />}
    </>
  )
}

/** Rappel visuel de la chaîne d'approvisionnement */
function SupplyChainStrip() {
  const chain = [
    { label: 'Agriculteur', icon: Sprout },
    { label: 'Collecteur', icon: PackagePlus },
    { label: 'Transporteur', icon: Truck },
    { label: 'Distributeur', icon: MapPin },
    { label: 'Consommateur', icon: ScanLine },
  ]
  return (
    <div className="mb-6 overflow-x-auto">
      <ol className="flex min-w-max items-center gap-2 text-xs font-medium">
        {chain.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-leaf/8 px-3 py-1.5">
              <c.icon className="size-3.5 text-leaf-fg" aria-hidden="true" /> {c.label}
            </span>
            {i < chain.length - 1 && <span className="text-leaf-fg" aria-hidden="true">→</span>}
          </li>
        ))}
        <li className="ms-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-leaf/50 px-3 py-1.5 text-leaf-fg">
          <Link2 className="size-3.5" aria-hidden="true" /> Blockchain + IA
        </li>
      </ol>
    </div>
  )
}

// ─────────────────────────────── Lots (module agriculteur) ───────────────────────────────

function LotsTab({ onStep }: { onStep: (code: string) => void }) {
  const role = useRole()
  const lots = useMyLots()
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<HarvestLot | null>(null)
  const [created, setCreated] = useState<HarvestLot | null>(null)
  const current = open ? (lots.data?.find((l) => l.code === open.code) ?? open) : null

  return (
    <div className="space-y-5">
      {role === 'agriculteur' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Enregistrez chaque récolte : un lot unique est créé, certifié et prêt à être étiqueté.</p>
          <Button variant="module" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" /> Enregistrer une récolte
          </Button>
        </div>
      )}

      {lots.isPending && <Skeleton className="h-48 rounded-2xl" />}
      {lots.isError && <EmptyState icon={Link2} title="Lots indisponibles" description={apiErrorMessage(lots.error)} />}
      {lots.data?.length === 0 && (
        <EmptyState
          icon={Sprout}
          title={role === 'agriculteur' ? 'Aucune récolte enregistrée' : 'Aucun lot manipulé pour l’instant'}
          description={role === 'agriculteur' ? 'Enregistrez votre première récolte pour obtenir son identifiant unique et son QR code.' : 'Scannez le QR code d’un lot dans l’onglet « Enregistrer une étape » pour l’ajouter à la chaîne.'}
          action={
            role === 'agriculteur' ? (
              <Button variant="module" onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" /> Enregistrer une récolte
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lots.data?.map((l) => (
          <button key={l.code} onClick={() => setOpen(l)} className="group flex gap-4 rounded-2xl border bg-card/70 p-4 text-start backdrop-blur transition-colors hover:border-leaf/40 hover:bg-card">
            <FreshnessGauge freshness={l.freshness} size="sm" />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold tracking-wider">{l.code}</span>
                <CertifiedMini verification={l.verification} />
              </div>
              <p className="truncate font-semibold">{l.product}</p>
              <p className="text-xs text-muted-foreground">
                {formatQty(l.currentQuantity, l.unit)} · récolté le {formatDate(l.harvestDate)}
              </p>
              <div className="pt-1">
                <StagePill stage={l.stage} />
              </div>
            </div>
          </button>
        ))}
      </div>

      <HarvestDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(lot) => {
          setCreating(false)
          setCreated(lot)
        }}
      />

      {/* Lot créé : son QR code à imprimer */}
      <Dialog open={Boolean(created)} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lot certifié</DialogTitle>
            <DialogDescription>Imprimez ce QR code et collez-le sur les caisses : chaque acteur et le consommateur pourront le scanner.</DialogDescription>
          </DialogHeader>
          {created && (
            <div className="flex flex-col items-center gap-3 py-2">
              <LotQrCode code={created.code} size={200} />
              <p className="text-center text-sm text-muted-foreground">
                {created.product} · {formatQty(created.quantity, created.unit)}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Détail d'un lot */}
      <Dialog open={Boolean(current)} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Passeport du lot</DialogTitle>
            <DialogDescription>Origine, parcours, fraîcheur estimée et registre vérifiable.</DialogDescription>
          </DialogHeader>
          {current && (
            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <LotPassport
                lot={current}
                actions={
                  current.stage !== 'vente' && (
                    <Button
                      size="sm"
                      variant="module"
                      onClick={() => {
                        setOpen(null)
                        onStep(current.code)
                      }}
                    >
                      <Plus aria-hidden="true" /> Ajouter une étape
                    </Button>
                  )
                }
              />
              <div className="order-first flex flex-col items-center gap-2 md:order-none">
                <LotQrCode code={current.code} size={140} />
                <Button asChild size="xs" variant="ghost">
                  <a href={publicLotUrl(current.code)} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden="true" /> Page publique
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

const today = () => new Date().toISOString().slice(0, 10)

function HarvestDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (l: HarvestLot) => void }) {
  const me = useMe()
  const create = useCreateLot()
  const empty = { product: '', category: 'legumes', variety: '', quantity: '', unit: 'kg', parcel: '', harvestDate: today(), organic: false, temperature: '', notes: '' }
  const [f, setF] = useState(empty)
  const [point, setPoint] = useState<Point | null>(null)
  const set = <K extends keyof typeof empty>(k: K, v: (typeof empty)[K]) => setF((x) => ({ ...x, [k]: v }))

  useEffect(() => {
    if (open) {
      setF(empty)
      setPoint(me.data?.lat != null && me.data?.lng != null ? { lat: me.data.lat, lng: me.data.lng } : null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function submit() {
    try {
      const lot = await create.mutateAsync({
        product: f.product,
        category: f.category,
        variety: f.variety || undefined,
        quantity: Number(f.quantity),
        unit: f.unit,
        parcel: f.parcel || undefined,
        harvestDate: f.harvestDate,
        organic: f.organic,
        temperature: f.temperature === '' ? undefined : Number(f.temperature),
        notes: f.notes || undefined,
        ...(point ? { lat: point.lat, lng: point.lng } : {}),
      })
      toast.success(`Récolte enregistrée : ${lot.code}`)
      onCreated(lot)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Enregistrer une récolte</DialogTitle>
          <DialogDescription>Un identifiant unique (LOT-…) et un QR code sont générés. Le bloc d’origine est scellé : il ne pourra plus être modifié.</DialogDescription>
        </DialogHeader>
        <form
          autoComplete="off"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Produit" id="h-product">
              <Input id="h-product" autoComplete="off" required minLength={2} maxLength={60} value={f.product} onChange={(e) => set('product', e.target.value)} placeholder="Tomates" />
            </Field>
            <Field label="Variété (facultatif)" id="h-variety">
              <Input id="h-variety" autoComplete="off" maxLength={60} value={f.variety} onChange={(e) => set('variety', e.target.value)} placeholder="Cœur de bœuf" />
            </Field>
            <Field label="Catégorie" id="h-cat">
              <Select value={f.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger id="h-cat" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <Field label="Quantité" id="h-qty">
                <Input id="h-qty" autoComplete="off" required type="number" min={0.1} step={0.1} inputMode="decimal" value={f.quantity} onChange={(e) => set('quantity', e.target.value)} />
              </Field>
              <Field label="Unité" id="h-unit">
                <Select value={f.unit} onValueChange={(v) => set('unit', v)}>
                  <SelectTrigger id="h-unit" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Date de récolte" id="h-date">
              <Input id="h-date" autoComplete="off" required type="date" max={today()} value={f.harvestDate} onChange={(e) => set('harvestDate', e.target.value)} />
            </Field>
            <Field label="Parcelle (facultatif)" id="h-parcel" hint="Utile en cas de rappel de lot">
              <Input id="h-parcel" autoComplete="off" maxLength={80} value={f.parcel} onChange={(e) => set('parcel', e.target.value)} placeholder="Parcelle Nord" />
            </Field>
            <Field label="Température au stockage (°C)" id="h-temp" hint="Améliore la prédiction de conservation">
              <Input id="h-temp" autoComplete="off" type="number" step={0.5} min={-30} max={60} inputMode="decimal" value={f.temperature} onChange={(e) => set('temperature', e.target.value)} placeholder="ex : 6" />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
              <input type="checkbox" className="size-4 accent-[#10B981]" checked={f.organic} onChange={(e) => set('organic', e.target.checked)} /> Agriculture biologique
            </label>
          </div>
          <Field label="Notes (facultatif)" id="h-notes">
            <Input id="h-notes" autoComplete="off" maxLength={300} value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Traitements, conditions de récolte…" />
          </Field>
          <div className="space-y-1.5">
            <Label>Lieu de récolte</Label>
            <div className="h-56 overflow-hidden rounded-xl">
              <LocationPicker value={point} onChange={setPoint} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" variant="module" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Créer le lot
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

// ─────────────────────────────── Étape (supply chain) ───────────────────────────────

function StepTab({ initialCode }: { initialCode: string | null }) {
  const [code, setCode] = useState<string | null>(initialCode)
  const [scanning, setScanning] = useState(false)
  const lot = useLot(code)
  const onCode = useCallback((c: string) => {
    setScanning(false)
    setCode(c)
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card/70 p-4">
        <QrCode className="size-5 text-leaf-fg" aria-hidden="true" />
        <p className="flex-1 text-sm">{code ? <>Lot sélectionné : <span className="font-mono font-bold">{code}</span></> : 'Scannez le QR code du lot que vous prenez en charge.'}</p>
        <Button variant="module" onClick={() => setScanning(true)}>
          <ScanLine aria-hidden="true" /> {code ? 'Scanner un autre lot' : 'Scanner / saisir un lot'}
        </Button>
      </div>
      <QrScannerDialog open={scanning} onClose={() => setScanning(false)} onCode={onCode} />

      {code && lot.isPending && <Skeleton className="h-64 rounded-2xl" />}
      {lot.isError && <EmptyState icon={AlertTriangle} title="Lot introuvable" description={apiErrorMessage(lot.error)} />}
      {lot.data && (
        <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
          <LotPassport lot={lot.data} />
          <div className="lg:sticky lg:top-6 lg:self-start">
            <StepForm lot={lot.data} />
          </div>
        </div>
      )}
      {!code && (
        <EmptyState icon={ScanLine} title="Aucun lot sélectionné" description="Collecteur, transporteur ou distributeur : scannez l’étiquette du lot pour enregistrer votre étape (prise en charge, transport, stockage, réception…)." action={<Button variant="module" onClick={() => setScanning(true)}>Scanner un lot</Button>} />
      )}
    </div>
  )
}

interface StepDraft {
  actorRole: ActorRole
  organization: string
  placeName: string
  temperature: string
  quantity: string
  note: string
  gps: Point | null
}

const emptyDraft = (stage: StepInput['stage']): StepDraft => ({ actorRole: STAGES.find((s) => s.id === stage)!.role, organization: '', placeName: '', temperature: '', quantity: '', note: '', gps: null })

function StepForm({ lot }: { lot: HarvestLot }) {
  const add = useAddStep()
  const done = lot.stage === 'vente'
  const nextDefault = (STAGES.find((s, i) => i > STAGES.findIndex((x) => x.id === lot.stage) && s.id !== 'stockage')?.id ?? 'transport') as StepInput['stage']
  const [stage, setStage] = useState<StepInput['stage']>(nextDefault)
  // Un brouillon par étape : ce qui est saisi pour « Collecte » ne se retrouve pas dans « Transport »
  const [drafts, setDrafts] = useState<Partial<Record<StepInput['stage'], StepDraft>>>({})
  const d = drafts[stage] ?? emptyDraft(stage)
  const setD = (patch: Partial<StepDraft>) => setDrafts((all) => ({ ...all, [stage]: { ...(all[stage] ?? emptyDraft(stage)), ...patch } }))
  const [locating, setLocating] = useState(false)

  // Autre lot : brouillons vidés. Étape enregistrée : on propose l'étape suivante.
  useEffect(() => {
    setDrafts({})
  }, [lot.code])
  useEffect(() => {
    setStage(nextDefault)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lot.code, lot.stage])

  function locate() {
    if (!navigator.geolocation) return toast.error('Géolocalisation indisponible sur cet appareil.')
    setLocating(true)
    const forStage = stage
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setDrafts((all) => ({ ...all, [forStage]: { ...(all[forStage] ?? emptyDraft(forStage)), gps: { lat: p.coords.latitude, lng: p.coords.longitude } } }))
        setLocating(false)
      },
      () => {
        setLocating(false)
        toast.error('Position refusée ou indisponible.')
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  async function submit() {
    try {
      await add.mutateAsync({
        code: lot.code,
        stage,
        actorRole: d.actorRole,
        organization: d.organization || undefined,
        placeName: d.placeName || undefined,
        temperature: d.temperature === '' ? undefined : Number(d.temperature),
        quantity: d.quantity === '' ? undefined : Number(d.quantity),
        note: d.note || undefined,
        ...(d.gps ?? {}),
      })
      toast.success(`Étape « ${stageLabel(stage)} » ajoutée au registre`)
      // Seul le brouillon de l'étape enregistrée est vidé
      setDrafts((all) => {
        const { [stage]: _sent, ...rest } = all
        return rest
      })
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  if (done) return <EmptyState icon={Link2} title="Chaîne close" description="Ce lot a été vendu au consommateur : plus aucune étape ne peut être ajoutée." />

  return (
    <form
      autoComplete="off"
      className="space-y-4 rounded-2xl border bg-card/70 p-5 backdrop-blur"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <h3 className="font-semibold">Ajouter mon étape</h3>
      <Field label="Étape" id="s-stage">
        <Select
          value={stage}
          onValueChange={(v) => setStage(v as StepInput['stage'])}
        >
          <SelectTrigger id="s-stage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.filter((s) => s.id !== 'recolte').map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.label} — {s.hint}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Je suis" id="s-role">
        <Select
          value={d.actorRole}
          onValueChange={(v) => setD({ actorRole: v as ActorRole })}
        >
          <SelectTrigger id="s-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTOR_ROLES.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Entreprise / structure (facultatif)" id="s-org">
        <Input id="s-org" autoComplete="off" maxLength={60} value={d.organization} onChange={(e) => setD({ organization: e.target.value })} placeholder="Coopérative du Sahel" />
      </Field>
      <Field label="Lieu" id="s-place">
        <div className="flex gap-2">
          <Input id="s-place" autoComplete="off" maxLength={80} value={d.placeName} onChange={(e) => setD({ placeName: e.target.value })} placeholder="Entrepôt de Sfax" />
          <Button type="button" variant="outline" size="icon" onClick={locate} aria-label="Utiliser ma position GPS" title="Utiliser ma position GPS">
            {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Crosshair aria-hidden="true" />}
          </Button>
        </div>
        {d.gps && <p className="text-xs text-leaf-fg">Position GPS jointe ({d.gps.lat.toFixed(4)}, {d.gps.lng.toFixed(4)})</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Température (°C)" id="s-temp">
          <Input id="s-temp" autoComplete="off" type="number" step={0.5} min={-30} max={60} inputMode="decimal" value={d.temperature} onChange={(e) => setD({ temperature: e.target.value })} placeholder="ex : 5" />
        </Field>
        <Field label={`Quantité (${UNITS.find((u) => u.id === lot.unit)?.label ?? lot.unit})`} id="s-qty">
          <Input id="s-qty" autoComplete="off" type="number" step={0.1} min={0} inputMode="decimal" value={d.quantity} onChange={(e) => setD({ quantity: e.target.value })} placeholder={String(lot.currentQuantity)} />
        </Field>
      </div>
      <Field label="Remarque (facultatif)" id="s-note">
        <Input id="s-note" autoComplete="off" maxLength={300} value={d.note} onChange={(e) => setD({ note: e.target.value })} placeholder="Camion frigorifique n° 12" />
      </Field>
      <Button type="submit" variant="module" className="w-full" disabled={add.isPending}>
        {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Signer et enregistrer l’étape
      </Button>
      <p className="text-xs text-muted-foreground">L’étape est chaînée au bloc précédent par son empreinte SHA-256 : elle ne pourra plus être modifiée.</p>
    </form>
  )
}

// ─────────────────────────────── Itinéraires (supply chain) ───────────────────────────────

interface Stop extends Point {
  label: string
  key: string
}

function RouteTab() {
  const me = useMe()
  const open = useOpenLots()
  const optimize = useOptimizeRoute()
  const [start, setStart] = useState<Point | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [custom, setCustom] = useState<Stop[]>([])
  const [adding, setAdding] = useState<Point | null>(null)
  const [addingLabel, setAddingLabel] = useState('')
  const [pickOpen, setPickOpen] = useState(false)
  const [result, setResult] = useState<(OptimizedRoute & { path?: [number, number][]; roadKm?: number; roadMin?: number }) | null>(null)

  useEffect(() => {
    if (!start && me.data?.lat != null && me.data?.lng != null) setStart({ lat: me.data.lat, lng: me.data.lng })
  }, [me.data, start])

  const located = useMemo(() => open.data?.filter((l) => l.lat !== null && l.lng !== null) ?? [], [open.data])
  const stops: Stop[] = useMemo(
    () => [
      ...located.filter((l) => selected.has(l.code)).map((l) => ({ lat: l.lat!, lng: l.lng!, label: `${l.code} · ${l.product} (${l.farmer.farmName || l.farmer.name})`, key: l.code })),
      ...custom,
    ],
    [located, selected, custom],
  )

  async function run() {
    if (!start) return toast.error('Choisissez le point de départ.')
    if (!stops.length) return toast.error('Ajoutez au moins un arrêt.')
    try {
      const r = await optimize.mutateAsync({ start, stops: stops.map(({ lat, lng, label }) => ({ lat, lng, label })) })
      setResult(r)
      // Tracé routier réel (OSRM) dans l'ordre optimisé, si le service répond
      const road = await roadRoute([start, ...r.stops])
      setResult({ ...r, path: road.path, roadKm: road.source === 'osrm' ? road.distanceM / 1000 : undefined, roadMin: road.source === 'osrm' ? road.durationS / 60 : undefined })
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  const mapStops: MapStop[] = result ? [{ ...start!, kind: 'ferme', label: 'Départ' }, ...result.stops.map((s, i) => ({ lat: s.lat, lng: s.lng, kind: 'client' as const, label: s.label ?? `Arrêt ${i + 1}`, n: i + 1 }))] : [...(start ? [{ ...start, kind: 'ferme' as const, label: 'Départ' }] : []), ...stops.map((s) => ({ lat: s.lat, lng: s.lng, kind: 'client' as const, label: s.label }))]

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-4">
        <div className="space-y-2 rounded-2xl border bg-card/70 p-4">
          <p className="text-sm font-semibold">1. Point de départ</p>
          <p className="text-xs text-muted-foreground">{start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : 'Non défini'}</p>
          <Button size="sm" variant="outline" onClick={() => setPickOpen(true)}>
            <MapPin aria-hidden="true" /> {start ? 'Changer' : 'Choisir sur la carte'}
          </Button>
        </div>

        <div className="space-y-2 rounded-2xl border bg-card/70 p-4">
          <p className="text-sm font-semibold">2. Lots à collecter / livrer</p>
          {open.isPending && <Skeleton className="h-20" />}
          {open.data && located.length === 0 && <p className="text-xs text-muted-foreground">Aucun lot localisé en circulation.</p>}
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {located.map((l) => (
              <li key={l.code}>
                <label className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-4 accent-[#10B981]"
                    checked={selected.has(l.code)}
                    onChange={(e) => {
                      const next = new Set(selected)
                      if (e.target.checked) next.add(l.code)
                      else next.delete(l.code)
                      setSelected(next)
                      setResult(null)
                    }}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {l.product} <span className="font-mono text-xs text-muted-foreground">{l.code}</span>
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {l.farmer.farmName || l.farmer.name} · {stageLabel(l.stage)} · fraîcheur {l.freshness.score}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-2xl border bg-card/70 p-4">
          <p className="text-sm font-semibold">3. Autres arrêts (distributeurs, entrepôts…)</p>
          <ul className="space-y-1">
            {custom.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{c.label}</span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`Retirer ${c.label}`}
                  onClick={() => {
                    setCustom(custom.filter((x) => x.key !== c.key))
                    setResult(null)
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" onClick={() => setAdding(start ?? { lat: 34.74, lng: 10.76 })}>
            <Plus aria-hidden="true" /> Ajouter un arrêt
          </Button>
        </div>

        <Button variant="module" className="w-full" onClick={() => void run()} disabled={optimize.isPending || !stops.length}>
          {optimize.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RouteIcon aria-hidden="true" />} Optimiser l’itinéraire ({stops.length} arrêt{stops.length > 1 ? 's' : ''})
        </Button>
      </div>

      <div className="space-y-4">
        {result && (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile icon={RouteIcon} label="Distance optimisée" value={`${(result.roadKm ?? result.distanceKm).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`} hint={result.roadKm ? 'par la route (OpenStreetMap)' : 'estimation'} />
            <StatTile icon={Truck} tone="water" label="Durée estimée" value={formatDuration((result.roadMin ?? result.durationMin) * 60)} />
            <StatTile icon={TrendingDown} tone="energy" label="Gain vs ordre saisi" value={`${result.savedPct} %`} hint={`${result.savedKm.toLocaleString('fr-FR')} km économisés (≈ ${(result.savedKm * 0.3).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} L de gazole)`} />
          </div>
        )}
        <DeliveryMap stops={mapStops} path={result?.path} className="h-[28rem]" />
        {result && (
          <ol className="space-y-1.5 text-sm">
            {result.stops.map((s, i) => (
              <li key={i} className="flex items-center gap-3 rounded-lg border bg-card/60 px-3 py-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-water text-xs font-bold text-white">{i + 1}</span>
                <span className="truncate">{s.label}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Dialog open={pickOpen} onOpenChange={setPickOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Point de départ</DialogTitle>
            <DialogDescription>Votre position, une adresse ou un clic sur la carte.</DialogDescription>
          </DialogHeader>
          <div className="h-72 overflow-hidden rounded-xl">
            <LocationPicker
              value={start}
              onChange={(p) => {
                setStart(p)
                setResult(null)
              }}
            />
          </div>
          <Button onClick={() => setPickOpen(false)}>Valider</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(adding)} onOpenChange={(o) => !o && setAdding(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un arrêt</DialogTitle>
            <DialogDescription>Distributeur, marché de gros, entrepôt frigorifique…</DialogDescription>
          </DialogHeader>
          <Input value={addingLabel} onChange={(e) => setAddingLabel(e.target.value)} placeholder="Nom de l’arrêt" maxLength={80} aria-label="Nom de l’arrêt" />
          <div className="h-64 overflow-hidden rounded-xl">
            <LocationPicker value={adding} onChange={setAdding} onAddress={(a) => !addingLabel && setAddingLabel(a.split(',')[0])} />
          </div>
          <Button
            onClick={() => {
              if (!adding) return
              setCustom([...custom, { ...adding, label: addingLabel || `Arrêt ${custom.length + 1}`, key: `c${Date.now()}` }])
              setAdding(null)
              setAddingLabel('')
              setResult(null)
            }}
          >
            Ajouter
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────── IA ───────────────────────────────

const SEVERITY: Record<Recommendation['severity'], { icon: typeof AlertOctagon; cls: string; label: string }> = {
  critique: { icon: AlertOctagon, cls: 'border-red-500/30 bg-red-500/8 text-red-600 dark:text-red-400', label: 'Urgent' },
  attention: { icon: AlertTriangle, cls: 'border-energy/30 bg-energy/8 text-energy-fg', label: 'À surveiller' },
  conseil: { icon: Lightbulb, cls: 'border-water/30 bg-water/8 text-water-fg', label: 'Conseil' },
}

function InsightsTab() {
  const q = useInsights()
  if (q.isPending) return <Skeleton className="h-96 rounded-2xl" />
  if (q.isError) return <EmptyState icon={BrainCircuit} title="Analyse indisponible" description={apiErrorMessage(q.error)} />
  const { stats, demand, recommendations } = q.data
  const chart = demand.map((d) => ({ name: categoryLabel(d.category), vendu: d.history[d.history.length - 1] ?? 0, prevu: d.forecast, trend: d.trend }))

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Link2} label="Lots suivis" value={stats.lots} hint={`${stats.inTransit} en circulation`} />
        <StatTile icon={Gauge} tone="water" label="Fraîcheur moyenne" value={stats.avgFreshness ?? '—'} hint="sur 100, lots en circulation" />
        <StatTile icon={AlertTriangle} tone={stats.atRisk ? 'danger' : 'leaf'} label="Lots à risque" value={stats.atRisk} hint="à écouler rapidement" />
        <StatTile icon={TrendingDown} tone="energy" label="Pertes constatées" value={stats.lossQuantity.toLocaleString('fr-FR')} hint="unités perdues le long de la chaîne" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card/70 p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <BrainCircuit className="size-4 text-leaf-fg" aria-hidden="true" /> Prédiction de la demande (semaine prochaine)
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Régression linéaire + lissage exponentiel sur 8 semaines de ventes du marché EcoNexus.</p>
          {chart.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Pas encore de ventes ni de lots : la prédiction apparaîtra avec les premières commandes.</p>
          ) : (
            <>
              <div className="mt-4 h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ left: -16, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'var(--muted)' }} contentStyle={{ borderRadius: 12, background: 'var(--popover)', border: '1px solid var(--border)', fontSize: 12 }} />
                    <Bar dataKey="vendu" name="Vendu cette semaine" fill="#94A3B8" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="prevu" name="Prévu semaine prochaine" radius={[6, 6, 0, 0]}>
                      {chart.map((c, i) => (
                        <Cell key={i} fill={c.trend === 'hausse' ? '#10B981' : c.trend === 'baisse' ? '#F59E0B' : '#0EA5E9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {demand.map((d) => (
                  <li key={d.category} className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1">
                    {d.trend === 'hausse' ? <TrendingUp className="size-3.5 text-leaf-fg" aria-hidden="true" /> : d.trend === 'baisse' ? <TrendingDown className="size-3.5 text-energy-fg" aria-hidden="true" /> : <span aria-hidden="true">→</span>}
                    {categoryLabel(d.category)} : {d.forecast.toLocaleString('fr-FR')}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="rounded-2xl border bg-card/70 p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Lightbulb className="size-4 text-energy-fg" aria-hidden="true" /> Recommandations pour réduire les pertes
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Fraîcheur prédite, chaîne du froid, pertes entre acteurs et équilibre offre / demande.</p>
          {recommendations.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Rien à signaler : vos lots sont bien conservés et l’offre suit la demande.</p>
          ) : (
            <ul className="mt-4 max-h-[22rem] space-y-2 overflow-y-auto pe-1">
              {recommendations.map((r, i) => {
                const s = SEVERITY[r.severity]
                return (
                  <li key={i} className={cn('rounded-xl border p-3', s.cls)}>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <s.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="text-foreground">{r.title}</span>
                    </p>
                    <p className="mt-1 ps-6 text-sm text-muted-foreground">{r.detail}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
