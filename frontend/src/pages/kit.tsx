import { Trash2 } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { toast } from 'sonner'
import { AnimatedCounter } from '@/components/common/animated-counter'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { DropZone } from '@/components/common/drop-zone'
import { ModuleIcon } from '@/components/common/module-icon'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { MODULES, toneHex } from '@/lib/modules'

/**
 * Kit UI : vitrine du design system. Sert de référence à l'équipe
 * pour réutiliser les mêmes composants partout.
 */
export default function KitPage() {
  const [file, setFile] = useState<File | null>(null)
  const [hours, setHours] = useState([6])

  return (
    <>
      <PageHeader
        title="Kit UI"
        description="Les couleurs, la typographie et les composants d'EcoNexus. Réutilisez-les pour que chaque écran parle la même langue."
      />

      <div className="space-y-14">
        <Section title="Couleurs" description="Chaque thématique a sa couleur. Elle n'apparaît que là où elle porte une information.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Swatch name="Agriculture" hex="#10B981" className="bg-leaf" />
            <Swatch name="Eau" hex="#0EA5E9" className="bg-water" />
            <Swatch name="Énergie" hex="#F59E0B" className="bg-energy" />
            <Swatch name="Fond" hex="var(--background)" className="bg-background" />
            <Swatch name="Texte" hex="var(--foreground)" className="bg-foreground" />
            <Swatch name="Texte secondaire" hex="var(--muted-foreground)" className="bg-muted-foreground" />
          </div>
        </Section>

        <Section title="Typographie" description="Plus Jakarta Sans pour tout. Les titres sont serrés et très gras, le texte courant reste aéré.">
          <div className="space-y-5 rounded-2xl border bg-card p-6">
            <p className="text-5xl leading-none font-extrabold tracking-[-0.03em]">Titre principal</p>
            <p className="text-[2rem] leading-tight font-extrabold tracking-[-0.025em]">Titre de page</p>
            <p className="text-xl font-bold">Titre de section</p>
            <p className="max-w-[65ch] text-base text-muted-foreground">
              Texte courant. Votre parcelle Nord montre des signes de mildiou sur 12 % des feuilles analysées : traitez dans les
              48 heures pour éviter la propagation.
            </p>
            <p className="tabular text-sm">Chiffres tabulaires : 1 284,50 kWh · 12,4 m³ · 87 %</p>
          </div>
        </Section>

        <Section title="Boutons" description="40 px de haut par défaut, 48 px pour les actions principales : confortables au doigt.">
          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg">Action principale</Button>
            <Button>Par défaut</Button>
            <Button variant="outline">Secondaire</Button>
            <Button variant="ghost">Discret</Button>
            <Button variant="destructive">Supprimer</Button>
            <Button disabled>Désactivé</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {MODULES.filter((m, i, all) => all.findIndex((x) => x.tone === m.tone) === i).map((m) => (
              // On surcharge localement --module pour montrer la variante dans chaque couleur
              <div key={m.tone} style={{ '--module': toneHex[m.tone] } as CSSProperties}>
                <Button variant="module" size="lg">
                  <m.icon aria-hidden="true" /> {m.name}
                </Button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Formulaires" description="Chaque champ a un libellé visible. Les erreurs disent quoi corriger.">
          <div className="grid gap-6 rounded-2xl border bg-card p-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="kit-parcel">Nom de la parcelle</Label>
              <Input id="kit-parcel" placeholder="Parcelle Nord" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kit-index">Index du compteur (m³)</Label>
              <Input id="kit-index" inputMode="decimal" defaultValue="12a4" aria-invalid="true" aria-describedby="kit-index-error" />
              <p id="kit-index-error" className="text-sm text-destructive">
                Saisissez uniquement des chiffres, par exemple 1248,6.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kit-crop">Culture</Label>
              <Select defaultValue="tomate">
                <SelectTrigger id="kit-crop" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tomate">Tomate</SelectItem>
                  <SelectItem value="pomme-de-terre">Pomme de terre</SelectItem>
                  <SelectItem value="mais">Maïs</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <Label id="kit-hours-label">Machine à laver en heures creuses</Label>
                <span className="tabular text-sm font-semibold">{hours[0]} fois / mois</span>
              </div>
              <Slider value={hours} onValueChange={setHours} max={20} step={1} aria-labelledby="kit-hours-label" />
            </div>
          </div>
        </Section>

        <Section title="Dépôt de fichier" description="Glisser-déposer sur ordinateur, appareil photo sur téléphone.">
          <DropZone
            accept="image/*,application/pdf"
            label="Déposez une photo ou une facture PDF"
            hint="JPG, PNG ou PDF, 10 Mo maximum"
            camera
            file={file}
            onFile={setFile}
          />
        </Section>

        <Section title="Chiffres animés" description="Pour les statistiques d'impact : le compteur démarre quand il entre à l'écran.">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat tone="water" label="litres d'eau économisés" value={128400} />
            <Stat tone="energy" label="kWh évités" value={9320} />
            <Stat tone="leaf" label="récoltes protégées" value={342} />
          </div>
        </Section>

        <Section title="Retours" description="Notifications après une action, squelettes pendant le chargement, confirmation avant suppression.">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => toast.success('Relevé enregistré')}>
              Notification de succès
            </Button>
            <Button variant="outline" onClick={() => toast.error("Le fichier n'est pas un PDF. Choisissez une facture au format PDF.")}>
              Notification d'erreur
            </Button>
            <ConfirmDialog
              trigger={
                <Button variant="destructive">
                  <Trash2 aria-hidden="true" /> Supprimer un diagnostic
                </Button>
              }
              title="Supprimer ce diagnostic ?"
              description="Le diagnostic de la Parcelle Nord du 18 novembre sera définitivement supprimé."
              onConfirm={async () => {
                await new Promise((r) => setTimeout(r, 700))
                toast.success('Diagnostic supprimé')
              }}
            />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3 rounded-2xl border bg-card p-5">
                <Skeleton className="size-10 rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Badges et icônes de module">
          <div className="flex flex-wrap items-center gap-3">
            {MODULES.map((m) => (
              <ModuleIcon key={m.id} icon={m.icon} tone={m.tone} />
            ))}
            <Badge>Nouveau</Badge>
            <Badge variant="secondary">Parcelle Nord</Badge>
            <Badge variant="outline">Agriculture</Badge>
            <Badge variant="destructive">Fuite possible</Badge>
          </div>
        </Section>
      </div>
    </>
  )
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

function Swatch({ name, hex, className }: { name: string; hex: string; className: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className={`h-16 border-b ${className}`} />
      <div className="space-y-0.5 p-3">
        <p className="text-sm font-semibold">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{hex}</p>
      </div>
    </div>
  )
}

function Stat({ tone, label, value }: { tone: 'leaf' | 'water' | 'energy'; label: string; value: number }) {
  const color = { leaf: 'text-leaf-fg', water: 'text-water-fg', energy: 'text-energy-fg' }[tone]
  return (
    <div className="rounded-2xl border bg-card p-5">
      <AnimatedCounter value={value} className={`block text-3xl font-extrabold tracking-tight ${color}`} />
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  )
}
