import { motion } from 'framer-motion'
import { ArrowRight, CloudRain, Droplet, Droplets, RotateCcw, Waves } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { formatNumber } from '../geo'
import { IRRIGATION_LABEL, STAGE_LABEL, type CropConfig, type Estimate, type Irrigation, type Species } from '../types'
import { TreeIllustration } from './tree-illustration'

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1960 + 1 }, (_, i) => CURRENT_YEAR - i)
const IRRIGATIONS: { id: Irrigation; icon: typeof Droplet; detail: string }[] = [
  { id: 'goutte-a-goutte', icon: Droplet, detail: '90 % efficace' },
  { id: 'aspersion', icon: Droplets, detail: '75 % efficace' },
  { id: 'gravitaire', icon: Waves, detail: '60 % efficace' },
  { id: 'pluvial', icon: CloudRain, detail: 'Pluie seule' },
]

/** Étape 2 : catalogue des espèces, fiche détaillée et paramètres de plantation */
export function StepCrop({
  species,
  loading,
  config,
  onChange,
  estimate,
  onNext,
}: {
  species: Species[] | undefined
  loading: boolean
  config: CropConfig
  onChange: (c: Partial<CropConfig>) => void
  estimate: Estimate | undefined
  onNext: () => void
}) {
  const selected = species?.find((s) => s.id === config.speciesId)
  const isTree = selected?.kind === 'tree'

  function pick(s: Species) {
    // Nouvelle espèce : on repart de ses valeurs recommandées
    onChange({ speciesId: s.id, rowSpacingM: s.rowSpacingM, treeSpacingM: s.treeSpacingM, pricePerKg: null })
  }

  return (
    <div className="space-y-7">
      <section aria-labelledby="tc-catalog" className="space-y-3">
        <h3 id="tc-catalog" className="text-sm font-semibold">
          Que voulez-vous cultiver ?
        </h3>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-2">
          {loading &&
            Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
          {species?.map((s) => (
            <motion.button
              key={s.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => pick(s)}
              aria-pressed={s.id === config.speciesId}
              className={cn(
                'group relative flex flex-col items-center gap-1 rounded-2xl border bg-background/50 p-3 text-center transition-colors',
                s.id === config.speciesId ? 'border-leaf bg-leaf/10 ring-2 ring-leaf/30' : 'hover:border-foreground/25',
              )}
            >
              <TreeIllustration speciesId={s.id} className="size-16 transition-transform duration-300 group-hover:-translate-y-0.5" />
              <span className="text-sm font-semibold">{s.name}</span>
              <span className="text-[0.7rem] text-muted-foreground">
                {s.kind === 'tree' ? `${formatNumber(s.waterM3PerTreeYear ?? 0, 1)} m³/arbre/an` : `${formatNumber(s.waterM3PerHaYear ?? 0)} m³/ha/an`}
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {selected && (
        <motion.div key={selected.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-7">
          <SpeciesSheet species={selected} estimate={estimate} />

          {/* Plantation */}
          {isTree && (
            <section className="space-y-3" aria-labelledby="tc-plantation">
              <h3 id="tc-plantation" className="text-sm font-semibold">
                Plantation
              </h3>
              <div role="radiogroup" aria-label="État du terrain" className="grid grid-cols-2 gap-2">
                <Choice active={config.plantingYear !== null} onClick={() => onChange({ plantingYear: config.plantingYear ?? CURRENT_YEAR - 5 })}>
                  Déjà planté
                </Choice>
                <Choice active={config.plantingYear === null} onClick={() => onChange({ plantingYear: null })}>
                  Terrain vide
                </Choice>
              </div>
              {config.plantingYear !== null ? (
                <div className="flex items-center gap-3">
                  <Label htmlFor="tc-year-planted" className="shrink-0">
                    Planté en
                  </Label>
                  <select
                    id="tc-year-planted"
                    value={config.plantingYear}
                    onChange={(e) => onChange({ plantingYear: Number(e.target.value) })}
                    className="tabular h-10 flex-1 rounded-lg border bg-background px-3 text-sm font-semibold"
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Plantation prévue en {CURRENT_YEAR} : l’estimation montre la montée en production année par année.</p>
              )}
            </section>
          )}

          {/* Espacement */}
          {isTree && (
            <section className="space-y-4" aria-labelledby="tc-spacing">
              <div className="flex items-center justify-between">
                <h3 id="tc-spacing" className="text-sm font-semibold">
                  Espacement
                </h3>
                {(config.rowSpacingM !== selected.rowSpacingM || config.treeSpacingM !== selected.treeSpacingM) && (
                  <button
                    onClick={() => onChange({ rowSpacingM: selected.rowSpacingM, treeSpacingM: selected.treeSpacingM })}
                    className="flex items-center gap-1 text-xs font-semibold text-leaf-fg hover:underline"
                  >
                    <RotateCcw className="size-3" aria-hidden="true" /> Recommandé ({selected.rowSpacingM} × {selected.treeSpacingM} m)
                  </button>
                )}
              </div>
              <SpacingSlider id="tc-row" label="Entre les rangs" value={config.rowSpacingM ?? 6} onChange={(v) => onChange({ rowSpacingM: v })} />
              <SpacingSlider id="tc-tree" label="Entre les arbres d’un rang" value={config.treeSpacingM ?? 5} onChange={(v) => onChange({ treeSpacingM: v })} />
            </section>
          )}

          {/* Irrigation */}
          <section className="space-y-3" aria-labelledby="tc-irrigation">
            <h3 id="tc-irrigation" className="text-sm font-semibold">
              Irrigation
            </h3>
            <div role="radiogroup" aria-labelledby="tc-irrigation" className="grid grid-cols-2 gap-2">
              {IRRIGATIONS.map((i) => (
                <Choice key={i.id} active={config.irrigation === i.id} onClick={() => onChange({ irrigation: i.id })}>
                  <i.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="text-left">
                    <span className="block">{IRRIGATION_LABEL[i.id]}</span>
                    <span className="block text-[0.7rem] font-normal text-muted-foreground">{i.detail}</span>
                  </span>
                </Choice>
              ))}
            </div>
          </section>

          {estimate?.trees && (
            <p className="rounded-xl bg-leaf/10 px-4 py-3 text-sm">
              <span className="tabular font-bold text-leaf-fg">≈ {formatNumber(estimate.trees.count)} arbres</span> sur votre terrain (
              {formatNumber(estimate.trees.densityPerHa)} / ha).{' '}
              {estimate.trees.previewScale > 1
                ? `Aperçu simplifié sur la carte : 1 point = ${estimate.trees.previewScale} arbres.`
                : estimate.trees.previewScale === 0
                  ? 'Terrain trop grand pour un aperçu arbre par arbre.'
                  : 'Ils sont dessinés sur la carte.'}
            </p>
          )}

          <Button size="lg" variant="module" className="w-full" onClick={onNext}>
            Voir l’estimation <ArrowRight aria-hidden="true" />
          </Button>
        </motion.div>
      )}
    </div>
  )
}

/** Fiche de l'espèce : illustration qui évolue avec l'âge + données agronomiques */
function SpeciesSheet({ species: s, estimate }: { species: Species; estimate: Estimate | undefined }) {
  const stage = estimate?.species.id === s.id ? (estimate.stage ?? 'mature') : 'mature'
  const age = estimate?.species.id === s.id ? estimate.age : null
  const maxKg = Math.max(...s.yieldCurve.map((p) => p.kg), 1)

  return (
    <section className="overflow-hidden rounded-2xl border bg-background/50" aria-label={`Fiche ${s.name}`}>
      <div className="flex items-center gap-4 bg-gradient-to-br from-leaf/15 to-transparent p-4">
        <TreeIllustration speciesId={s.id} stage={stage} className="size-24 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{s.name}</h3>
          {s.kind === 'tree' && age !== null && (
            <p className="text-sm font-semibold text-leaf-fg">
              {age > 0 ? `${age} an${age > 1 ? 's' : ''}` : 'À planter'} · {STAGE_LABEL[stage]}
            </p>
          )}
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.description}</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-border text-sm">
        {s.kind === 'tree' ? (
          <>
            <Fact label="Espacement conseillé" value={`${s.rowSpacingM} × ${s.treeSpacingM} m`} />
            <Fact label="Besoin en eau" value={`${formatNumber(s.waterM3PerTreeYear ?? 0, 1)} m³/arbre/an`} />
            <Fact label="Première récolte" value={`${s.firstProductionAge} ans`} />
            <Fact label="Pleine production" value={`${s.fullProductionAge} ans · ${s.fullYieldKgPerTree} kg/arbre`} />
            <Fact label="Durée de vie" value={`${s.lifespanYears} ans`} />
            <Fact label="Résistance sécheresse" value={capitalize(s.droughtTolerance)} />
          </>
        ) : (
          <>
            <Fact label="Rendement moyen" value={`${formatNumber((s.yieldKgPerHa ?? 0) / 1000, 1)} t/ha`} />
            <Fact label="Besoin en eau" value={`${formatNumber(s.waterM3PerHaYear ?? 0)} m³/ha`} />
            <Fact label="Cycle" value="Annuel" />
            <Fact label="Résistance sécheresse" value={capitalize(s.droughtTolerance)} />
          </>
        )}
        <Fact label="Climat adapté" value={s.climate} className="col-span-2" />
      </dl>
      {s.yieldCurve.length > 0 && (
        <div className="space-y-2 p-4">
          <p className="text-xs font-semibold">Rendement moyen par arbre selon l’âge</p>
          <div className="flex h-20 items-end gap-2" role="list">
            {s.yieldCurve.map((p) => (
              <div key={p.age} role="listitem" className="flex flex-1 flex-col items-center gap-1" title={`${p.age} ans : ${p.kg} kg`}>
                <span className="tabular text-[0.65rem] font-semibold">{formatNumber(p.kg, 1)} kg</span>
                <motion.div
                  className="w-full rounded-t-[4px] bg-leaf/80"
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (p.kg / maxKg) * 44)}px` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                />
                <span className="tabular text-[0.65rem] text-muted-foreground">{p.age} ans</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Fact({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn('bg-card px-4 py-3', className)}>
      <dt className="text-[0.7rem] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
    </div>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors',
        active ? 'border-leaf bg-leaf/10 text-foreground ring-1 ring-leaf/30' : 'bg-background/50 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function SpacingSlider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <Label id={id}>{label}</Label>
        <span className="tabular text-sm font-bold">{formatNumber(value, 1)} m</span>
      </div>
      <Slider aria-labelledby={id} min={1} max={15} step={0.5} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
