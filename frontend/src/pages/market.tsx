import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Loader2, MapPin, Minus, Plus, Search, ShoppingBasket, Sprout, Store, Trash2, Truck, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useMe } from '@/features/auth/auth'
import {
  CATEGORIES,
  cartStore,
  DELIVERY,
  formatDate,
  formatPrice,
  formatQty,
  groupCart,
  stepFor,
  unitLong,
  useCart,
  useCatalog,
  useCheckout,
  type Category,
  type Product,
} from '@/features/market/api'
import { OrganicBadge, ProductVisual } from '@/features/market/components'
import { LocationPicker } from '@/features/market/live-map'
import type { Point } from '@/features/market/routing'
import { apiErrorMessage } from '@/features/terracalc/api'
import { cn } from '@/lib/utils'

/** Marché (client) : produits frais des fermes, panier, commande */
export default function MarketPage() {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [selected, setSelected] = useState<Product | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const catalog = useCatalog(debounced, category)
  const cart = useCart()
  const count = cart.length

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <>
      <PageHeader
        title="Marché"
        description="Produits frais vendus directement par les agriculteurs. Vous savez d’où vient chaque produit et quand il a été récolté."
        icon={Store}
        tone="leaf"
        actions={
          <Button size="lg" onClick={() => setCartOpen(true)} className="relative" aria-label={`Ouvrir le panier (${count} produit${count > 1 ? 's' : ''})`}>
            <ShoppingBasket aria-hidden="true" /> Panier
            {count > 0 && (
              <motion.span key={count} initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="ms-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-leaf px-1.5 text-xs font-bold text-white">
                {count}
              </motion.span>
            )}
          </Button>
        }
      />

      {/* Recherche + catégories */}
      <div className="sticky top-16 z-10 -mx-4 mb-6 space-y-3 bg-background/80 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-10 lg:px-10">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit, une ferme, une origine…" className="h-11 ps-9 pe-9" aria-label="Rechercher" />
          {query && (
            <button onClick={() => setQuery('')} className="absolute end-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground" aria-label="Effacer la recherche">
              <X className="size-4" />
            </button>
          )}
        </div>
        <div role="radiogroup" aria-label="Catégorie" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {[{ id: null, label: 'Tout' }, ...CATEGORIES].map((c) => (
            <button
              key={c.id ?? 'all'}
              role="radio"
              aria-checked={category === c.id}
              onClick={() => setCategory(c.id as Category | null)}
              className={cn(
                'h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors',
                category === c.id ? 'border-transparent bg-foreground text-background' : 'bg-background/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {catalog.isPending && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      )}
      {catalog.isError && <EmptyState icon={Store} title="Marché indisponible" description={apiErrorMessage(catalog.error)} />}
      {catalog.data?.length === 0 && (
        <EmptyState
          icon={Search}
          title="Aucun produit trouvé"
          description={debounced || category ? 'Essayez une autre recherche ou une autre catégorie.' : 'Les agriculteurs n’ont encore rien mis en vente. Revenez bientôt !'}
          action={
            (debounced || category) && (
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('')
                  setCategory(null)
                }}
              >
                Tout afficher
              </Button>
            )
          }
        />
      )}

      {catalog.data && catalog.data.length > 0 && (
        <ul className={cn('grid grid-cols-2 gap-3 transition-opacity sm:gap-4 md:grid-cols-3 xl:grid-cols-4', catalog.isFetching && 'opacity-70')}>
          {catalog.data.map((p, i) => (
            <motion.li key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
              <ProductCard product={p} inCart={cart.find((l) => l.productId === p.id)?.quantity} onOpen={() => setSelected(p)} />
            </motion.li>
          ))}
        </ul>
      )}

      <ProductDialog product={selected} onClose={() => setSelected(null)} onAdded={() => setCartOpen(true)} />
      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />

      {/* Barre flottante sur mobile : le panier toujours à portée de pouce */}
      <AnimatePresence>
        {count > 0 && !cartOpen && (
          <motion.div initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} className="fixed start-4 end-20 bottom-4 z-20 sm:hidden">
            <Button size="lg" className="w-full shadow-xl" onClick={() => setCartOpen(true)}>
              <ShoppingBasket aria-hidden="true" /> Voir le panier · {formatPrice(groupCart(cart).reduce((s, g) => s + g.total, 0))}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function ProductCard({ product: p, inCart, onOpen }: { product: Product; inCart?: number; onOpen: () => void }) {
  const low = p.stock <= stepFor(p.unit) * 5
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card/70 backdrop-blur transition-shadow hover:shadow-lg">
      <button onClick={onOpen} className="relative block aspect-[4/3] overflow-hidden text-start" aria-label={`Voir ${p.name}`}>
        <ProductVisual photoUrl={p.photoUrl} category={p.category} name={p.name} className="size-full transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute start-2 top-2 flex gap-1">{p.organic && <OrganicBadge className="bg-background/85 backdrop-blur" />}</div>
        {inCart ? (
          <span className="absolute end-2 top-2 rounded-full bg-leaf px-2 py-0.5 text-[0.7rem] font-bold text-white">{formatQty(inCart, p.unit)} au panier</span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
        <button onClick={onOpen} className="text-start">
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold sm:text-base">{p.name}</h3>
        </button>
        <p className="truncate text-xs text-muted-foreground">
          <Sprout className="me-1 inline size-3 align-[-2px]" aria-hidden="true" />
          {p.farmer?.farmName || p.farmer?.name}
          {p.farmer?.placeName && ` · ${p.farmer.placeName}`}
        </p>
        {p.harvestDate && <p className="text-xs text-muted-foreground">Récolté le {formatDate(p.harvestDate)}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p>
            <span className="text-lg font-extrabold tabular-nums">{formatPrice(p.price)}</span>
            <span className="block text-[0.7rem] text-muted-foreground">{unitLong(p.unit)}</span>
          </p>
          <Button
            size="icon-sm"
            variant="module"
            aria-label={`Ajouter ${p.name} au panier`}
            onClick={() => {
              cartStore.add(p)
              toast.success(`${p.name} ajouté au panier`, { duration: 1800 })
            }}
          >
            <Plus />
          </Button>
        </div>
        {low && <p className="text-[0.7rem] font-medium text-amber-600 dark:text-amber-400">Plus que {formatQty(p.stock, p.unit)}</p>}
      </div>
    </div>
  )
}

/** Fiche produit : traçabilité (ferme, parcelle, récolte) et choix de la quantité */
function ProductDialog({ product: p, onClose, onAdded }: { product: Product | null; onClose: () => void; onAdded: () => void }) {
  const [qty, setQty] = useState(1)
  useEffect(() => {
    if (p) setQty(stepFor(p.unit))
  }, [p])
  if (!p) return <Dialog open={false} />
  const step = stepFor(p.unit)
  const set = (v: number) => setQty(Math.max(step, Math.min(Math.round(v * 10) / 10, p.stock)))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <ProductVisual photoUrl={p.photoUrl} category={p.category} name={p.name} className="aspect-[16/9] w-full" iconClassName="size-16" />
        <div className="space-y-4 p-5">
          <DialogHeader className="text-start">
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-xl">{p.name}</DialogTitle>
              {p.organic && <OrganicBadge />}
            </div>
            <DialogDescription>{p.description || 'Produit frais vendu directement par la ferme.'}</DialogDescription>
          </DialogHeader>

          <dl className="grid grid-cols-1 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-2">
            <Trace icon={Sprout} label="Ferme" value={p.farmer?.farmName || p.farmer?.name || '—'} />
            <Trace icon={MapPin} label="Origine" value={[p.origin, p.farmer?.placeName].filter(Boolean).join(' · ') || '—'} />
            <Trace icon={CalendarDays} label="Récolte" value={p.harvestDate ? formatDate(p.harvestDate) : 'Non précisée'} />
            <Trace icon={Store} label="Disponible" value={formatQty(p.stock, p.unit)} />
          </dl>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center rounded-xl border" role="group" aria-label="Quantité">
              <Button variant="ghost" size="icon" onClick={() => set(qty - step)} disabled={qty <= step} aria-label="Moins">
                <Minus />
              </Button>
              <output className="min-w-20 text-center font-semibold tabular-nums" aria-live="polite">
                {formatQty(qty, p.unit)}
              </output>
              <Button variant="ghost" size="icon" onClick={() => set(qty + step)} disabled={qty + step > p.stock} aria-label="Plus">
                <Plus />
              </Button>
            </div>
            <p className="text-end">
              <span className="block text-xl font-extrabold tabular-nums">{formatPrice(p.price * qty)}</span>
              <span className="text-xs text-muted-foreground">
                {formatPrice(p.price)} {unitLong(p.unit)}
              </span>
            </p>
          </div>
        </div>
        <DialogFooter className="border-t bg-muted/25 p-4">
          <Button
            size="lg"
            variant="module"
            className="w-full"
            onClick={() => {
              cartStore.add(p, qty)
              onClose()
              onAdded()
            }}
          >
            <ShoppingBasket aria-hidden="true" /> Ajouter au panier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
function Trace({ icon: Icon, label, value }: { icon: typeof Sprout; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-leaf-fg" aria-hidden="true" />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="ms-auto truncate font-medium sm:ms-0">{value}</dd>
    </div>
  )
}

/** Panier, regroupé par ferme (une commande et des frais de livraison par ferme) */
function CartSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const cart = useCart()
  const groups = useMemo(() => groupCart(cart), [cart])
  const total = groups.reduce((s, g) => s + g.total, 0)
  const [checkout, setCheckout] = useState(false)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-5">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <ShoppingBasket className="size-5" aria-hidden="true" /> Mon panier
            </SheetTitle>
            <SheetDescription>{groups.length > 1 ? `${groups.length} fermes : vous recevrez ${groups.length} livraisons.` : 'Livraison directe depuis la ferme.'}</SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {cart.length === 0 && <EmptyState icon={ShoppingBasket} title="Panier vide" description="Ajoutez des produits du marché pour passer commande." className="border-none" />}
            {groups.map((g) => (
              <section key={g.farmerId} aria-label={g.farmName} className="space-y-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Sprout className="size-4 text-leaf-fg" aria-hidden="true" /> {g.farmName}
                </h3>
                <ul className="space-y-3">
                  {g.lines.map((l) => (
                    <li key={l.productId} className="flex gap-3">
                      <ProductVisual photoUrl={l.photoUrl} category={l.category} name={l.name} className="size-14 shrink-0 rounded-xl" iconClassName="size-6" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium">{l.name}</p>
                          <button onClick={() => cartStore.remove(l.productId)} className="text-muted-foreground hover:text-destructive" aria-label={`Retirer ${l.name}`}>
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-1 flex items-center justify-between">
                          <div className="flex items-center rounded-lg border" role="group" aria-label={`Quantité de ${l.name}`}>
                            <Button variant="ghost" size="icon-xs" onClick={() => cartStore.setQuantity(l.productId, l.quantity - stepFor(l.unit))} aria-label="Moins">
                              <Minus />
                            </Button>
                            <span className="min-w-16 text-center text-xs font-semibold tabular-nums">{formatQty(l.quantity, l.unit)}</span>
                            <Button variant="ghost" size="icon-xs" onClick={() => cartStore.setQuantity(l.productId, l.quantity + stepFor(l.unit))} disabled={l.quantity + stepFor(l.unit) > l.stock} aria-label="Plus">
                              <Plus />
                            </Button>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">{formatPrice(l.price * l.quantity)}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Truck className="size-3.5" aria-hidden="true" /> Livraison
                    </span>
                    {g.deliveryFee === 0 ? <span className="font-semibold text-leaf-fg">Offerte</span> : <span className="font-medium tabular-nums">{formatPrice(g.deliveryFee)}</span>}
                  </div>
                  {g.deliveryFee > 0 && (
                    <>
                      <p className="mt-1 text-muted-foreground">Offerte dès {formatPrice(DELIVERY.freeFrom)} : encore {formatPrice(DELIVERY.freeFrom - g.subtotal)} chez cette ferme.</p>
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-border" aria-hidden="true">
                        <div className="h-full rounded-full bg-leaf transition-[width]" style={{ width: `${Math.min(100, (g.subtotal / DELIVERY.freeFrom) * 100)}%` }} />
                      </div>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>

          {cart.length > 0 && (
            <div className="space-y-3 border-t bg-muted/25 p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-extrabold tabular-nums">{formatPrice(total)}</span>
              </div>
              <Button size="lg" variant="module" className="w-full" onClick={() => setCheckout(true)}>
                Commander
              </Button>
              <p className="text-center text-xs text-muted-foreground">Paiement à la livraison</p>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <CheckoutDialog
        open={checkout}
        onOpenChange={setCheckout}
        total={total}
        farms={groups.length}
        onDone={() => {
          setCheckout(false)
          onOpenChange(false)
        }}
      />
    </>
  )
}

function CheckoutDialog({ open, onOpenChange, total, farms, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; total: number; farms: number; onDone: () => void }) {
  const me = useMe()
  const cart = useCart()
  const checkout = useCheckout()
  const navigate = useNavigate()
  const [form, setForm] = useState({ address: '', phone: '', note: '' })
  const [spot, setSpot] = useState<Point | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, phone: f.phone || me.data?.phone || '', address: f.address || me.data?.placeName || '' }))
      setSpot((s) => s ?? (me.data?.lat != null && me.data?.lng != null ? { lat: me.data.lat, lng: me.data.lng } : null))
      setError(null)
    }
  }, [open, me.data])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (form.address.trim().length < 5) return setError('Indiquez une adresse de livraison complète.')
    if (!/^[+\d][\d\s.-]{5,19}$/.test(form.phone.trim())) return setError('Indiquez un numéro de téléphone valide : le livreur vous appellera à l’arrivée.')
    if (!spot) return setError('Placez votre point de livraison sur la carte : c’est là que le livreur viendra.')
    try {
      const orders = await checkout.mutateAsync({ items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })), address: form.address.trim(), phone: form.phone.trim(), lat: spot.lat, lng: spot.lng, note: form.note.trim() || undefined })
      cartStore.clear()
      onDone()
      toast.success(orders.length > 1 ? `${orders.length} commandes envoyées aux fermes` : 'Commande envoyée à la ferme', { description: 'Vous suivrez chaque étape dans « Mes commandes ».' })
      navigate('/app/commandes')
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Livraison</DialogTitle>
          <DialogDescription>{farms > 1 ? `Chacune des ${farms} fermes recevra sa commande et un livreur vous l’apportera.` : 'La ferme prépare votre commande, puis un livreur vous l’apporte.'}</DialogDescription>
        </DialogHeader>
        <form id="checkout-form" onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label>Point de livraison</Label>
            <LocationPicker value={spot} onChange={setSpot} onAddress={(a) => setForm((f) => ({ ...f, address: a }))} />
            <p className="text-xs text-muted-foreground">Vous pourrez suivre le livreur en direct jusqu’à ce point.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-address">Adresse (rue, bâtiment, étage)</Label>
            <Input id="co-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Rue, numéro, ville" autoComplete="street-address" maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-phone">Téléphone</Label>
            <Input id="co-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+216 20 123 456" autoComplete="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="co-note">Note pour la ferme (facultatif)</Label>
            <Input id="co-note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex : sonner au 2e étage" maxLength={300} />
          </div>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter className="items-center sm:justify-between">
          <p className="text-sm">
            Total <span className="font-bold tabular-nums">{formatPrice(total)}</span>
            <span className="block text-xs text-muted-foreground">Paiement à la livraison</span>
          </p>
          <Button type="submit" form="checkout-form" size="lg" variant="module" disabled={checkout.isPending}>
            {checkout.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Confirmer la commande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
