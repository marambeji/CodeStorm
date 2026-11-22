import { AlertTriangle, MapPin, CheckCircle2, ClipboardList, Coins, EyeOff, ImageUp, Loader2, MoreHorizontal, PackageCheck, PencilLine, Plus, Store, Trash2, Truck, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  CATEGORIES,
  categoryLabel,
  formatDate,
  formatPrice,
  formatQty,
  UNITS,
  unitLong,
  useDeleteProduct,
  useMyProducts,
  useOrders,
  useSaveProduct,
  useShopSummary,
  useTransition,
  WHOLE_UNITS,
  type Category,
  type Order,
  type Product,
  type ProductInput,
  type Unit,
} from '@/features/market/api'
import { OrderCard, OrganicBadge, PillTabs, ProductVisual, StatTile } from '@/features/market/components'
import { LiveTracking } from '@/features/market/tracking'
import { useMe } from '@/features/auth/auth'
import { ProfileDialog } from '@/features/profile/profile-dialog'
import { apiErrorMessage } from '@/features/terracalc/api'
import { cn } from '@/lib/utils'

const TO_HANDLE: Order['status'][] = ['en_attente', 'acceptee']
const IN_TRANSIT: Order['status'][] = ['prete', 'prise_en_charge', 'en_livraison']

/** Ma boutique (agriculteur) : mettre en vente, puis accepter et préparer les commandes */
export default function ShopPage() {
  const summary = useShopSummary()
  const [tab, setTab] = useState<'commandes' | 'produits'>('commandes')
  const [editing, setEditing] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null })
  const s = summary.data
  const me = useMe()
  const [profileOpen, setProfileOpen] = useState(false)
  const noFarmLocation = me.data && (me.data.lat == null || me.data.lng == null)

  return (
    <>
      <PageHeader
        title="Ma boutique"
        description="Vendez vos récoltes en direct. Vous acceptez la commande, la préparez, et un livreur l’apporte au client."
        icon={Store}
        tone="leaf"
        actions={
          <Button size="lg" variant="module" onClick={() => setEditing({ open: true, product: null })}>
            <Plus aria-hidden="true" /> Mettre en vente
          </Button>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {s ? (
          <>
            <StatTile icon={ClipboardList} label="À traiter" value={s.toHandle} hint={s.toHandle ? 'Commandes à accepter ou préparer' : 'Rien en attente'} tone={s.toHandle ? 'energy' : 'leaf'} />
            <StatTile icon={Truck} label="Chez le livreur" value={s.inTransit} hint="Prêtes ou en route" tone="water" />
            <StatTile icon={Coins} label="Ventes livrées" value={formatPrice(s.revenue)} hint={`${s.delivered} commande${s.delivered > 1 ? 's' : ''}`} />
            <StatTile icon={Store} label="En vente" value={s.activeProducts} hint={s.lowStock ? `${s.lowStock} en stock bas` : 'Stocks suffisants'} tone={s.lowStock ? 'danger' : 'leaf'} />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
        )}
      </div>

      {noFarmLocation && (
        <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <MapPin className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">Indiquez où se trouve votre ferme.</span>
            <span className="block text-muted-foreground">Sans cette position, les livreurs ne peuvent pas calculer leur itinéraire jusqu’à vous.</span>
          </p>
          <Button size="sm" variant="outline" onClick={() => setProfileOpen(true)}>
            Ajouter la position
          </Button>
        </div>
      )}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      <PillTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'commandes', label: 'Commandes reçues', count: s?.toHandle },
          { id: 'produits', label: 'Mes produits', count: s?.activeProducts },
        ]}
      />

      {tab === 'commandes' ? <FarmerOrders /> : <Products onEdit={(p) => setEditing({ open: true, product: p })} onCreate={() => setEditing({ open: true, product: null })} />}

      <ProductFormDialog open={editing.open} product={editing.product} onOpenChange={(open) => setEditing((e) => ({ ...e, open }))} />
    </>
  )
}

// ─────────────────────────────── Commandes ───────────────────────────────

function FarmerOrders() {
  const orders = useOrders()
  const [filter, setFilter] = useState<'traiter' | 'route' | 'historique'>('traiter')
  const groups = {
    traiter: orders.data?.filter((o) => TO_HANDLE.includes(o.status)) ?? [],
    route: orders.data?.filter((o) => IN_TRANSIT.includes(o.status)) ?? [],
    historique: orders.data?.filter((o) => !TO_HANDLE.includes(o.status) && !IN_TRANSIT.includes(o.status)) ?? [],
  }
  const list = groups[filter]

  if (orders.isPending) return <Skeleton className="h-64 rounded-2xl" />
  if (orders.isError) return <EmptyState icon={ClipboardList} title="Commandes indisponibles" description={apiErrorMessage(orders.error)} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filtrer les commandes">
        {(
          [
            ['traiter', 'À traiter'],
            ['route', 'Chez le livreur'],
            ['historique', 'Historique'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="radio"
            aria-checked={filter === id}
            onClick={() => setFilter(id)}
            className={cn('h-9 rounded-full border px-4 text-sm font-medium transition-colors', filter === id ? 'border-transparent bg-foreground text-background' : 'bg-background/60 text-muted-foreground hover:text-foreground')}
          >
            {label} <span className="ms-1 tabular-nums opacity-70">{groups[id].length}</span>
          </button>
        ))}
      </div>
      {list.length === 0 && (
        <EmptyState
          icon={filter === 'traiter' ? CheckCircle2 : filter === 'route' ? Truck : ClipboardList}
          title={filter === 'traiter' ? 'Tout est à jour' : filter === 'route' ? 'Aucune commande chez un livreur' : 'Pas encore d’historique'}
          description={filter === 'traiter' ? 'Les nouvelles commandes de vos clients apparaîtront ici.' : filter === 'route' ? 'Les commandes que vous marquez « prêtes » sont récupérées par un livreur.' : 'Les commandes livrées, refusées ou annulées apparaîtront ici.'}
        />
      )}
      {list.map((o) => (
        <FarmerOrder key={o.id} order={o} />
      ))}
    </div>
  )
}

function FarmerOrder({ order }: { order: Order }) {
  const transition = useTransition()
  const [refusing, setRefusing] = useState(false)
  const [reason, setReason] = useState('')

  async function run(action: 'accepter' | 'preparer' | 'refuser', note?: string) {
    try {
      await transition.mutateAsync({ id: order.id, action, note })
      toast.success(action === 'accepter' ? 'Commande acceptée' : action === 'preparer' ? 'Commande prête : les livreurs sont prévenus' : 'Commande refusée, le stock a été remis en vente')
      setRefusing(false)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }
  const busy = transition.isPending

  return (
    <>
      <OrderCard
        order={order}
        perspective="agriculteur"
        highlight={
          order.status === 'acceptee' ? (
            <p className="rounded-xl bg-sky-500/10 px-3 py-2 text-sm text-sky-800 dark:text-sky-200">Préparez les produits puis marquez la commande « prête » : un livreur viendra la récupérer à la ferme.</p>
          ) : order.status === 'prise_en_charge' ? (
            <LiveTracking order={order} perspective="agriculteur" />
          ) : null
        }
        actions={
          order.actions.length ? (
            <>
              {order.actions.includes('refuser') && (
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => setRefusing(true)}>
                  Refuser
                </Button>
              )}
              {order.actions.includes('accepter') && (
                <Button variant="module" size="sm" disabled={busy} onClick={() => run('accepter')}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} Accepter
                </Button>
              )}
              {order.actions.includes('preparer') && (
                <Button variant="module" size="sm" disabled={busy} onClick={() => run('preparer')}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackageCheck aria-hidden="true" />} Commande prête
                </Button>
              )}
            </>
          ) : undefined
        }
      />
      <Dialog open={refusing} onOpenChange={setRefusing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refuser la commande {order.reference} ?</DialogTitle>
            <DialogDescription>Le client est prévenu et les quantités sont remises en vente. Expliquer pourquoi l’aide à comprendre.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={`refuse-${order.id}`}>Raison (facultatif)</Label>
            <Input id={`refuse-${order.id}`} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex : récolte abîmée par la grêle" maxLength={200} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefusing(false)}>
              Garder la commande
            </Button>
            <Button className="bg-destructive text-white hover:bg-destructive/90 dark:text-[#0b1120]" disabled={busy} onClick={() => run('refuser', reason.trim() || undefined)}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />} Refuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─────────────────────────────── Produits ───────────────────────────────

function Products({ onEdit, onCreate }: { onEdit: (p: Product) => void; onCreate: () => void }) {
  const products = useMyProducts()
  const save = useSaveProduct()
  const del = useDeleteProduct()

  if (products.isPending)
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  if (products.isError) return <EmptyState icon={Store} title="Produits indisponibles" description={apiErrorMessage(products.error)} />
  if (!products.data.length)
    return (
      <EmptyState
        icon={Store}
        title="Rien en vente pour le moment"
        description="Ajoutez votre premier produit : nom, prix, stock et, si possible, une photo et la date de récolte. Les clients le verront aussitôt sur le marché."
        action={
          <Button variant="module" onClick={onCreate}>
            <Plus aria-hidden="true" /> Mettre en vente
          </Button>
        }
      />
    )

  const toggle = async (p: Product) => {
    try {
      await save.mutateAsync({ id: p.id, input: { ...toInput(p), active: !p.active } })
      toast.success(p.active ? `${p.name} retiré du marché` : `${p.name} remis en vente`)
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {products.data.map((p) => {
        const low = p.active && p.stock <= 5
        const out = p.stock <= 0
        return (
          <li key={p.id} className={cn('flex gap-4 rounded-2xl border bg-card/70 p-3 backdrop-blur', !p.active && 'opacity-60')}>
            <ProductVisual photoUrl={p.photoUrl} category={p.category} name={p.name} className="size-24 shrink-0 rounded-xl" iconClassName="size-8" />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {categoryLabel(p.category)}
                    {p.harvestDate && ` · récolté le ${formatDate(p.harvestDate)}`}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Options pour ${p.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(p)}>
                      <PencilLine /> Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => toggle(p)}>
                      {p.active ? <EyeOff /> : <Store />} {p.active ? 'Retirer du marché' : 'Remettre en vente'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <ConfirmDialog
                      trigger={
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                          <Trash2 /> Supprimer
                        </DropdownMenuItem>
                      }
                      title={`Supprimer « ${p.name} » ?`}
                      description="Le produit disparaît du marché. Les commandes déjà passées restent dans votre historique."
                      onConfirm={async () => {
                        try {
                          await del.mutateAsync(p.id)
                          toast.success('Produit supprimé')
                        } catch (e) {
                          toast.error(apiErrorMessage(e))
                        }
                      }}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-2">
                <p className="text-sm">
                  <span className="text-base font-bold tabular-nums">{formatPrice(p.price)}</span> <span className="text-xs text-muted-foreground">{unitLong(p.unit)}</span>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {p.organic && <OrganicBadge />}
                  {!p.active ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-medium">Retiré</span>
                  ) : out ? (
                    <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-600 dark:text-red-400">Épuisé</span>
                  ) : (
                    <span className={cn('rounded-full px-2 py-0.5 font-medium tabular-nums', low ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-muted')}>
                      {low && <AlertTriangle className="me-1 inline size-3 align-[-2px]" aria-hidden="true" />}
                      {formatQty(p.stock, p.unit)} en stock
                    </span>
                  )}
                  {(p.sold ?? 0) > 0 && <span className="text-muted-foreground">{formatQty(p.sold ?? 0, p.unit)} vendus</span>}
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const toInput = (p: Product): ProductInput => ({
  name: p.name,
  category: p.category,
  unit: p.unit,
  price: p.price,
  stock: p.stock,
  description: p.description ?? '',
  origin: p.origin ?? '',
  harvestDate: p.harvestDate ? p.harvestDate.slice(0, 10) : '',
  organic: p.organic,
  active: p.active,
})

const EMPTY = { name: '', category: 'legumes' as Category, unit: 'kg' as Unit, price: '', stock: '', description: '', origin: '', harvestDate: '', organic: false, active: true }
const today = () => new Date().toISOString().slice(0, 10)

/** Formulaire produit : création et modification */
function ProductFormDialog({ open, product, onOpenChange }: { open: boolean; product: Product | null; onOpenChange: (o: boolean) => void }) {
  const save = useSaveProduct()
  const [form, setForm] = useState(EMPTY)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setForm(product ? { ...toInput(product), price: String(product.price), stock: String(product.stock) } : { ...EMPTY, harvestDate: today() })
    setPhoto(null)
    setPreview(product?.photoUrl ?? null)
    setRemovePhoto(false)
    setError(null)
  }, [open, product])

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const whole = WHOLE_UNITS.includes(form.unit)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const price = Number(form.price.replace(',', '.'))
    const stock = Number(form.stock.replace(',', '.'))
    if (form.name.trim().length < 2) return setError('Donnez un nom au produit (2 caractères minimum).')
    if (!(price >= 0.1)) return setError('Indiquez un prix d’au moins 0,10 €.')
    if (!(stock >= 0)) return setError('Indiquez la quantité disponible.')
    if (whole && !Number.isInteger(stock)) return setError(`Le stock en « ${UNITS.find((u) => u.id === form.unit)?.label} » doit être un nombre entier.`)
    try {
      await save.mutateAsync({
        id: product?.id,
        input: { ...form, name: form.name.trim(), description: form.description.trim(), origin: form.origin.trim(), price: Math.round(price * 100) / 100, stock: Math.round(stock * 10) / 10, photo, removePhoto: removePhoto && !photo },
      })
      toast.success(product ? 'Produit modifié' : 'Produit mis en vente', { description: product ? undefined : 'Il est maintenant visible sur le marché.' })
      onOpenChange(false)
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{product ? `Modifier « ${product.name} »` : 'Mettre un produit en vente'}</DialogTitle>
          <DialogDescription>L’origine et la date de récolte s’affichent sur la fiche produit : c’est ce qui rassure les clients.</DialogDescription>
        </DialogHeader>

        <form id="product-form" onSubmit={submit} className="space-y-4" noValidate>
          {/* Photo */}
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => fileRef.current?.click()} className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-dashed" aria-label="Choisir une photo">
              {preview && !removePhoto ? (
                <img src={preview} alt="Aperçu" className="size-full object-cover" />
              ) : (
                <ProductVisual photoUrl={null} category={form.category} name={form.name || 'Produit'} className="size-full" iconClassName="size-8" />
              )}
            </button>
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <ImageUp aria-hidden="true" /> {preview && !removePhoto ? 'Changer la photo' : 'Ajouter une photo'}
                </Button>
                {preview && !removePhoto && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPhoto(null)
                      setRemovePhoto(true)
                      if (fileRef.current) fileRef.current.value = ''
                    }}
                  >
                    <X aria-hidden="true" /> Retirer
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Facultatif. JPG ou PNG, 6 Mo maximum.</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f && f.size > 6 * 1024 * 1024) return toast.error('Photo trop lourde (6 Mo maximum).')
                if (f) {
                  setPhoto(f)
                  setRemovePhoto(false)
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-name">Nom du produit</Label>
            <Input id="pr-name" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ex : Tomates de plein champ" maxLength={60} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pr-cat">Catégorie</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v as Category)}>
                <SelectTrigger id="pr-cat" className="w-full">
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-unit">Vendu à</Label>
              <Select value={form.unit} onValueChange={(v) => set('unit', v as Unit)}>
                <SelectTrigger id="pr-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.long}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-price">Prix (€ {unitLong(form.unit)})</Label>
              <Input id="pr-price" inputMode="decimal" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="Ex : 2,50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-stock">Quantité disponible ({UNITS.find((u) => u.id === form.unit)?.label})</Label>
              <Input id="pr-stock" inputMode={whole ? 'numeric' : 'decimal'} value={form.stock} onChange={(e) => set('stock', e.target.value)} placeholder={whole ? 'Ex : 20' : 'Ex : 50'} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-origin">Origine (parcelle, lieu)</Label>
              <Input id="pr-origin" value={form.origin} onChange={(e) => set('origin', e.target.value)} placeholder="Ex : Parcelle Nord" maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-harvest">Date de récolte</Label>
              <Input id="pr-harvest" type="date" value={form.harvestDate} max={today()} onChange={(e) => set('harvestDate', e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pr-desc">Description (facultatif)</Label>
            <textarea
              id="pr-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Variété, goût, conseils de conservation…"
              className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Check id="pr-bio" checked={form.organic} onChange={(v) => set('organic', v)} label="Agriculture biologique" />
            <Check id="pr-active" checked={form.active} onChange={(v) => set('active', v)} label="Visible sur le marché" />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form="product-form" variant="module" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} {product ? 'Enregistrer' : 'Mettre en vente'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Check({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 rounded accent-[var(--color-leaf,#10B981)]" />
      {label}
    </label>
  )
}
