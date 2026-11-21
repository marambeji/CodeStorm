import { AnimatePresence, motion } from 'framer-motion'
import { Bug, Camera, Eye, FlaskConical, Leaf, Loader2, ScanSearch, ShieldCheck, Sparkles, Sprout, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DropZone } from '@/components/common/drop-zone'
import { EmptyState } from '@/components/common/empty-state'
import { Reveal, RevealItem } from '@/components/fx/reveal'
import { SpotlightCard } from '@/components/fx/spotlight-card'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/features/terracalc/api'
import { useCatalog, useDeleteDiagnosis, useDiagnose, useHistory, useUpdateDiagnosis } from '@/features/plantdoc/api'
import { classifyLeaf, type Prediction } from '@/features/plantdoc/classifier'
import { AskBox, LeafThumb, ListenButton, SeverityBadge } from '@/features/plantdoc/components'
import { sampleLeaf } from '@/features/plantdoc/sample-leaf'
import { STATUS_LABEL, type Diagnosis, type DiagnosisStatus } from '@/features/plantdoc/types'
import { WeatherWidget } from '@/features/weather/weather'
import { MODULES } from '@/lib/modules'
import { cn } from '@/lib/utils'

const MODULE = MODULES.find((m) => m.id === 'plantdoc')!
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })

/** PlantDoc : diagnostic d'une feuille par photo + historique par parcelle */
export default function PlantDocPage() {
  const { t } = useTranslation()
  const catalog = useCatalog()
  const history = useHistory()
  const diagnose = useDiagnose()

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [crop, setCrop] = useState('')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<{ diagnosis: Diagnosis; prediction: Prediction | null } | null>(null)

  function pickFile(f: File | null) {
    setFile(f)
    setResult(null)
    if (preview) URL.revokeObjectURL(preview)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  async function analyze() {
    if (!file || !catalog.data) return
    setScanning(true)
    setResult(null)
    try {
      // Analyse locale (secours si l'IA ne répond pas), puis diagnostic par Gemini Vision côté serveur
      const prediction = await classifyLeaf(file, crop || 'tomate', catalog.data.diseases).catch(() => null)
      const diagnosis = await diagnose.mutateAsync({ image: file, crop, ...(prediction ?? {}) })
      setResult({ diagnosis, prediction })
      toast.success('Diagnostic enregistré', { description: `${diagnosis.disease} · ${diagnosis.details?.cropName ?? diagnosis.parcel}` })
    } catch (e) {
      toast.error(apiErrorMessage(e))
    } finally {
      setScanning(false)
    }
  }

  return (
    <>
      <PageHeader title={MODULE.name} description={t('modules.plantdoc.description')} icon={MODULE.icon} tone="leaf" meta={<Badge variant="outline">{t('themes.agriculture')}</Badge>} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* ── Nouveau diagnostic ── */}
        <SpotlightCard color="#10B981" className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-bold">Nouveau diagnostic</h2>
          <div className="space-y-5">
            <DropZone accept="image/*" label="Photo d’une feuille" hint="Une seule feuille, bien éclairée, qui remplit l’image" camera file={file} onFile={pickFile} />
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={async () => pickFile(await sampleLeaf('malade'))}>
                <FlaskConical aria-hidden="true" /> Feuille malade d’exemple
              </Button>
              <Button variant="ghost" size="sm" onClick={async () => pickFile(await sampleLeaf('saine'))}>
                <Sprout aria-hidden="true" /> Feuille saine d’exemple
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pd-crop">Culture</Label>
              <select
                id="pd-crop"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-3 text-sm dark:bg-input/30"
              >
                <option value="">Détection automatique par l’IA</option>
                {catalog.data?.crops.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button size="lg" variant="module" className="w-full" onClick={analyze} disabled={!file || scanning || !catalog.data}>
              {scanning ? <Loader2 className="animate-spin" aria-hidden="true" /> : <ScanSearch aria-hidden="true" />}
              {scanning ? 'L’IA examine la feuille (jusqu’à 30 s)…' : 'Analyser la feuille'}
            </Button>
            {!file && <p className="text-center text-xs text-muted-foreground">Ajoutez une photo pour lancer l’analyse.</p>}
          </div>
        </SpotlightCard>

        {/* ── Résultat ── */}
        <SpotlightCard color="#10B981" className="p-5 sm:p-6 lg:min-h-[28rem]">
          <AnimatePresence mode="wait">
            {scanning && preview ? (
              <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full flex-col items-center justify-center gap-5">
                <div className="relative aspect-[4/3] w-full max-w-md overflow-hidden rounded-2xl">
                  <img src={preview} alt="Feuille en cours d’analyse" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-leaf/10" />
                  <div className="animate-scan absolute inset-x-0 h-1 bg-leaf shadow-[0_0_24px_6px_rgb(16_185_129/0.6)]" />
                  {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2', 'bottom-3 left-3 border-b-2 border-l-2', 'right-3 bottom-3 border-r-2 border-b-2'].map((c) => (
                    <span key={c} className={`absolute size-8 rounded-sm border-white ${c}`} />
                  ))}
                </div>
                <p role="status" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Recherche des symptômes sur la feuille…
                </p>
              </motion.div>
            ) : result ? (
              <motion.div key={result.diagnosis.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <ResultView diagnosis={result.diagnosis} prediction={result.prediction} preview={preview} catalogNames={Object.fromEntries((catalog.data?.diseases ?? []).map((d) => [d.key, d.name]))} />
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-56 flex-col items-center justify-center gap-4 text-center lg:min-h-[24rem]">
                <span className="flex size-16 items-center justify-center rounded-3xl bg-leaf/12 text-leaf-fg ring-1 ring-inset ring-leaf/25">
                  <Leaf className="size-7" aria-hidden="true" />
                </span>
                <div className="max-w-sm space-y-1.5">
                  <p className="text-lg font-bold">Le diagnostic s’affichera ici</p>
                  <p className="text-sm text-muted-foreground">Maladie détectée, niveau de confiance, gravité et traitement conseillé, en langage simple.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </SpotlightCard>
      </div>

      {/* La météo influence le risque de maladie (mildiou par temps doux et humide) */}
      <WeatherWidget className="mt-5" />

      <HistorySection history={history} />
    </>
  )
}

function ResultView({ diagnosis: d, prediction: p, preview, catalogNames }: { diagnosis: Diagnosis; prediction: Prediction | null; preview: string | null; catalogNames: Record<string, string> }) {
  const healthy = d.severity === 'aucune'
  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        <LeafThumb imageUrl={preview ?? d.imageUrl} severity={d.severity} className="size-24 shrink-0 rounded-2xl sm:size-28" />
        <div className="min-w-0 space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-leaf-fg">
            {healthy ? <ShieldCheck className="size-3.5" aria-hidden="true" /> : <Bug className="size-3.5" aria-hidden="true" />}
            {healthy ? 'Aucune maladie détectée' : `Maladie détectée · ${d.info?.agent ?? ''}`}
          </p>
          <h3 className="text-2xl leading-tight font-extrabold tracking-tight">{d.disease}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={d.severity} />
            <span className="text-xs text-muted-foreground">{d.parcel}</span>
          </div>
        </div>
      </div>

      {/* Confiance + alternatives */}
      <div className="space-y-2.5 rounded-2xl border bg-background/50 p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">Confiance du diagnostic</span>
          <span className="tabular font-bold">{Math.round(d.confidence * 100)} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Confiance" aria-valuenow={Math.round(d.confidence * 100)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div className="h-full rounded-full bg-leaf" initial={{ width: 0 }} animate={{ width: `${d.confidence * 100}%` }} transition={{ duration: 0.8 }} />
        </div>
        {d.details?.symptomsSeen && (
          <p className="pt-1 text-sm">
            <span className="font-semibold">Ce que l’IA voit : </span>
            <span className="text-muted-foreground">{d.details.symptomsSeen}</span>
          </p>
        )}
        <ul className="space-y-1 pt-1 text-xs text-muted-foreground">
          {(d.details?.engine === 'gemini' ? d.details.alternatives : (p?.top.slice(1).map((t) => ({ name: catalogNames[t.diseaseKey] ?? t.diseaseKey, confidence: t.confidence })) ?? [])).map((t) => (
            <li key={t.name} className="flex justify-between gap-3">
              <span>Autre hypothèse : {t.name}</span>
              <span className="tabular">{Math.round(t.confidence * 100)} %</span>
            </li>
          ))}
        </ul>
        <p className="text-[0.7rem] text-muted-foreground">
          {d.details?.engine === 'gemini' ? `Analysé par l’IA (Gemini Vision) · culture : ${d.details.cropName}.` : 'Analyse locale dans votre navigateur (IA indisponible).'} Surface atteinte estimée :{' '}
          {Math.round((d.details?.affectedRatio ?? p?.affectedRatio ?? 0) * 100)} %.
        </p>
      </div>

      {/* Conseil */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-energy-fg" aria-hidden="true" /> Que faire ?
          </h4>
          <ListenButton text={`${d.advice} ${d.tips.join(' ')}`} />
        </div>
        <p className="text-sm leading-relaxed">{d.advice}</p>
        <ul className="space-y-1.5">
          {d.tips.map((t) => (
            <li key={t} className="flex gap-2 text-sm text-muted-foreground">
              <Sprout className="mt-0.5 size-4 shrink-0 text-leaf-fg" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-2 border-t pt-4">
        <h4 className="text-sm font-semibold">Une question ? Écrivez-la ou dictez-la</h4>
        <AskBox diagnosisId={d.id} />
      </div>
    </div>
  )
}

// ─────────────────────────── Historique ───────────────────────────

function HistorySection({ history }: { history: ReturnType<typeof useHistory> }) {
  const [filter, setFilter] = useState<string>('toutes')
  const [open, setOpen] = useState<Diagnosis | null>(null)
  const parcels = useMemo(() => {
    const counts = new Map<string, number>()
    history.data?.forEach((d) => counts.set(d.parcel, (counts.get(d.parcel) ?? 0) + 1))
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [history.data])
  const items = history.data?.filter((d) => filter === 'toutes' || d.parcel === filter) ?? []

  return (
    <section className="mt-12 space-y-5" aria-labelledby="pd-history">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="pd-history" className="text-xl font-bold">
          Historique par parcelle
        </h2>
        {history.data && <span className="text-sm text-muted-foreground">{history.data.length} diagnostics</span>}
      </div>

      {parcels.length > 0 && (
        <div role="tablist" aria-label="Filtrer par parcelle" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[['toutes', history.data?.length ?? 0] as const, ...parcels].map(([p, n]) => (
            <button
              key={p}
              role="tab"
              aria-selected={filter === p}
              onClick={() => setFilter(p)}
              className={cn(
                'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
                filter === p ? 'border-transparent bg-foreground text-background' : 'bg-background/50 text-muted-foreground hover:text-foreground',
              )}
            >
              {p === 'toutes' ? 'Toutes' : p}
              <span className={cn('tabular text-xs', filter === p ? 'opacity-70' : 'opacity-60')}>{n}</span>
            </button>
          ))}
        </div>
      )}

      {history.isPending && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      )}
      {history.isError && <EmptyState icon={Leaf} title="Historique indisponible" description={apiErrorMessage(history.error)} />}
      {history.data?.length === 0 && <EmptyState icon={Camera} title="Aucun diagnostic pour l’instant" description="Analysez votre première feuille : le résultat sera rangé ici, parcelle par parcelle." />}

      {items.length > 0 && (
        <Reveal key={`${filter}-${items.map((d) => d.id).join()}`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((d) => (
            <RevealItem key={d.id}>
              <HistoryCard diagnosis={d} onOpen={() => setOpen(d)} />
            </RevealItem>
          ))}
        </Reveal>
      )}

      <DetailDialog diagnosis={open} onClose={() => setOpen(null)} />
    </section>
  )
}

function HistoryCard({ diagnosis: d, onOpen }: { diagnosis: Diagnosis; onOpen: () => void }) {
  const update = useUpdateDiagnosis()
  const del = useDeleteDiagnosis()
  return (
    <SpotlightCard color="#10B981" className="flex h-full flex-col">
      <button onClick={onOpen} className="flex gap-3.5 p-4 text-left" aria-label={`Voir le diagnostic ${d.disease}, ${d.parcel}`}>
        <LeafThumb imageUrl={d.imageUrl} severity={d.severity} className="size-20 shrink-0 rounded-xl" />
        <div className="min-w-0 space-y-1.5">
          <p className="truncate font-bold">{d.disease}</p>
          <p className="truncate text-xs text-muted-foreground">
            {d.parcel} · {fmtDate(d.createdAt)} · {Math.round(d.confidence * 100)} %
          </p>
          <SeverityBadge severity={d.severity} />
        </div>
      </button>
      <div className="mt-auto flex items-center gap-1 border-t px-3 py-2">
        <label htmlFor={`st-${d.id}`} className="sr-only">
          Statut du traitement
        </label>
        <select
          id={`st-${d.id}`}
          value={d.status}
          disabled={d.severity === 'aucune' || update.isPending}
          onChange={(e) =>
            update.mutate(
              { id: d.id, status: e.target.value as DiagnosisStatus },
              { onSuccess: (r) => toast.success(`Statut : ${STATUS_LABEL[r.status].toLowerCase()}`), onError: (err) => toast.error(apiErrorMessage(err)) },
            )
          }
          className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm font-medium disabled:opacity-60"
        >
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="icon-sm" onClick={onOpen} aria-label="Voir le détail">
          <Eye />
        </Button>
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive" aria-label={`Supprimer le diagnostic ${d.disease}`}>
              <Trash2 />
            </Button>
          }
          title="Supprimer ce diagnostic ?"
          description={`Le diagnostic « ${d.disease} » du ${fmtDate(d.createdAt)} (${d.parcel}) et sa photo seront définitivement supprimés.`}
          onConfirm={async () => {
            try {
              await del.mutateAsync(d.id)
              toast.success('Diagnostic supprimé')
            } catch (err) {
              toast.error(apiErrorMessage(err))
            }
          }}
        />
      </div>
    </SpotlightCard>
  )
}

/** Détail d'un diagnostic : symptômes, traitement, notes modifiables, questions à l'IA */
function DetailDialog({ diagnosis, onClose }: { diagnosis: Diagnosis | null; onClose: () => void }) {
  const update = useUpdateDiagnosis()
  const [notes, setNotes] = useState('')
  const [parcel, setParcel] = useState('')
  const d = diagnosis

  return (
    <Dialog
      open={Boolean(d)}
      onOpenChange={(o) => {
        if (!o) onClose()
        else if (d) {
          setNotes(d.notes ?? '')
          setParcel(d.parcel)
        }
      }}
    >
      {d && (
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl" onOpenAutoFocus={() => (setNotes(d.notes ?? ''), setParcel(d.parcel))}>
          <DialogHeader>
            <DialogTitle className="text-xl">{d.disease}</DialogTitle>
            <DialogDescription>
              {d.parcel} · {new Date(d.createdAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <LeafThumb imageUrl={d.imageUrl} severity={d.severity} className="h-28 w-40 shrink-0 rounded-2xl" />
              <div className="space-y-2">
                <SeverityBadge severity={d.severity} />
                <p className="text-sm text-muted-foreground">Confiance : {Math.round(d.confidence * 100)} %</p>
                <ListenButton text={`${d.advice} ${d.tips.join(' ')}`} />
              </div>
            </div>
            {d.info && !d.info.healthy && (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="font-semibold">Symptômes</dt>
                  <dd className="text-muted-foreground">{d.info.symptoms}</dd>
                </div>
                <div>
                  <dt className="font-semibold">Traitement</dt>
                  <dd className="text-muted-foreground">{d.info.treatment}</dd>
                </div>
                <div>
                  <dt className="font-semibold">En bio</dt>
                  <dd className="text-muted-foreground">{d.info.organic}</dd>
                </div>
              </dl>
            )}
            <form
              className="space-y-3 rounded-2xl border p-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (parcel.trim().length < 2) return toast.error('Le nom de la parcelle doit faire au moins 2 caractères.')
                update.mutate(
                  { id: d.id, parcel: parcel.trim(), notes: notes.trim() },
                  { onSuccess: () => (toast.success('Diagnostic mis à jour'), onClose()), onError: (err) => toast.error(apiErrorMessage(err)) },
                )
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="pd-edit-parcel">Parcelle</Label>
                <input id="pd-edit-parcel" value={parcel} onChange={(e) => setParcel(e.target.value)} maxLength={40} className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm dark:bg-input/30" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pd-notes">Notes de suivi</Label>
                <textarea
                  id="pd-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Ex : traité au cuivre le 12/11, à revérifier dans 10 jours."
                  className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm dark:bg-input/30"
                />
              </div>
              <Button type="submit" variant="module" disabled={update.isPending}>
                {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                Enregistrer les modifications
              </Button>
            </form>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Poser une question</h4>
              <AskBox diagnosisId={d.id} />
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  )
}
