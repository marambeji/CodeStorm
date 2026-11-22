import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Coins, History, House, KeyRound, Loader2, LocateFixed, LocateOff, MapPin, Navigation, PackageCheck, PackageSearch, Route as RouteIcon, Sprout, Truck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, ON_THE_ROAD, useAvailableDeliveries, useOrders, useShareCourierPosition, useTransition, type Order, type ShareState } from '@/features/market/api'
import { DeliveryMap } from '@/features/market/live-map'
import { arrivalTime, formatDistance, formatDuration, googleMapsUrl, planTour, route, type Point, type Stop as TourStop } from '@/features/market/routing'
import { cn } from '@/lib/utils'
import { OrderCard, PillTabs, StatTile } from '@/features/market/components'
import { apiErrorMessage } from '@/features/terracalc/api'

/** Livraisons (livreur) : récupérer les commandes prêtes à la ferme, puis les remettre au client avec son code */
export default function DeliveriesPage() {
  const available = useAvailableDeliveries()
  const mine = useOrders()
  const current = mine.data?.filter((o) => ON_THE_ROAD.includes(o.status)) ?? []
  // Partage GPS automatique tant qu'il y a une commande en cours
  const share = useShareCourierPosition(current.length > 0)
  const done = mine.data?.filter((o) => o.status === 'livree') ?? []
  const [tab, setTab] = useState<'disponibles' | 'cours' | 'historique'>(current.length ? 'cours' : 'disponibles')
  const earned = done.reduce((s, o) => s + o.deliveryFee, 0)

  const list = tab === 'disponibles' ? available : mine
  const orders = tab === 'disponibles' ? (available.data ?? []) : tab === 'cours' ? current : done

  return (
    <>
      <PageHeader title="Livraisons" description="Prenez en charge une commande prête à la ferme, livrez-la, puis validez la remise avec le code du client." icon={Truck} tone="energy" />

      <div className="mb-8 grid grid-cols-3 gap-3">
        <StatTile icon={PackageSearch} label="À récupérer" value={available.data?.length ?? '–'} tone="energy" />
        <StatTile icon={Truck} label="En cours" value={mine.data ? current.length : '–'} tone="water" />
        <StatTile icon={Coins} label="Frais de livraison" value={mine.data ? formatPrice(earned) : '–'} hint={`${done.length} livrée${done.length > 1 ? 's' : ''}`} />
      </div>

      <PillTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'disponibles', label: 'Disponibles', count: available.data?.length },
          { id: 'cours', label: 'En cours', count: current.length },
          { id: 'historique', label: 'Historique' },
        ]}
      />

      {list.isPending && <Skeleton className="h-64 rounded-2xl" />}
      {list.isError && <EmptyState icon={Truck} title="Livraisons indisponibles" description={apiErrorMessage(list.error)} />}
      {list.data && orders.length === 0 && (
        <EmptyState
          icon={tab === 'disponibles' ? PackageSearch : tab === 'cours' ? Truck : History}
          title={tab === 'disponibles' ? 'Aucune commande à récupérer' : tab === 'cours' ? 'Aucune livraison en cours' : 'Aucune livraison terminée'}
          description={tab === 'disponibles' ? 'Dès qu’une ferme prépare une commande, elle apparaît ici. La liste se met à jour toute seule.' : tab === 'cours' ? 'Prenez une commande dans « Disponibles » pour commencer une tournée.' : 'Vos livraisons réussies apparaîtront ici.'}
        />
      )}
      {tab === 'cours' && current.length > 0 && <TourPanel orders={current} position={share.position} state={share.state} />}
      <div className="space-y-4">
        {orders.map((o) => (
          <CourierOrder key={o.id} order={o} onTaken={() => setTab('cours')} />
        ))}
      </div>
    </>
  )
}

function CourierOrder({ order, onTaken }: { order: Order; onTaken: () => void }) {
  const transition = useTransition()
  const [delivering, setDelivering] = useState(false)
  const farm = order.farmer.farmName || order.farmer.name
  const maps = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`

  async function take() {
    try {
      await transition.mutateAsync({ id: order.id, action: 'prendre' })
      toast.success(`Commande ${order.reference} prise en charge`, { description: `Récupérez-la à ${farm}.` })
      onTaken()
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  async function pickUp() {
    try {
      await transition.mutateAsync({ id: order.id, action: 'recuperer' })
      toast.success('Commande récupérée', { description: `Direction ${order.client.name}. Le client vous suit en direct.` })
    } catch (e) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <>
      <OrderCard
        order={order}
        perspective="livreur"
        highlight={
          order.status !== 'livree' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Stop step="1" label="Récupérer à la ferme" place={[farm, order.farmer.placeName].filter(Boolean).join(', ')} href={order.pickupLat != null ? maps(`${order.pickupLat},${order.pickupLng}`) : maps([farm, order.farmer.placeName].filter(Boolean).join(' '))} done={order.status === 'en_livraison'} />
              <Stop step="2" label="Livrer au client" place={order.address} href={order.deliveryLat != null ? maps(`${order.deliveryLat},${order.deliveryLng}`) : maps(order.address)} />
            </div>
          ) : null
        }
        actions={
          order.actions.includes('prendre') ? (
            <Button variant="module" size="sm" onClick={take} disabled={transition.isPending}>
              {transition.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Truck aria-hidden="true" />} Prendre en charge · {order.deliveryFee ? formatPrice(order.deliveryFee) : 'livraison offerte'}
            </Button>
          ) : order.actions.includes('recuperer') ? (
            <Button variant="module" size="sm" onClick={pickUp} disabled={transition.isPending}>
              {transition.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackageCheck aria-hidden="true" />} Commande récupérée à la ferme
            </Button>
          ) : order.actions.includes('livrer') ? (
            <Button variant="module" size="sm" onClick={() => setDelivering(true)}>
              <KeyRound aria-hidden="true" /> Valider la remise
            </Button>
          ) : undefined
        }
      />
      <DeliverDialog order={order} open={delivering} onOpenChange={setDelivering} />
    </>
  )
}

function Stop({ step, label, place, href, done }: { step: string; label: string; place: string; href: string; done?: boolean }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="group flex items-center gap-3 rounded-xl border bg-background/50 px-3 py-2.5 transition-colors hover:bg-muted">
      <span className={done ? 'flex size-7 shrink-0 items-center justify-center rounded-full bg-leaf text-white' : 'flex size-7 shrink-0 items-center justify-center rounded-full bg-energy/15 text-xs font-bold text-energy-fg'}>
        {done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : step}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="flex items-center gap-1 truncate text-sm font-medium">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" /> {place || '—'}
        </span>
      </span>
      <Navigation className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-label="Itinéraire" />
    </a>
  )
}

/** Remise : le client donne son code à 4 chiffres, preuve que la commande est bien arrivée */
function DeliverDialog({ order, open, onOpenChange }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void }) {
  const transition = useTransition()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\d{4}$/.test(code)) return setError('Le code fait 4 chiffres.')
    try {
      await transition.mutateAsync({ id: order.id, action: 'livrer', code })
      toast.success('Livraison validée', { description: `${order.reference} remise à ${order.client.name}.` })
      onOpenChange(false)
      setCode('')
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Valider la remise</DialogTitle>
          <DialogDescription>Demandez à {order.client.name} le code à 4 chiffres affiché dans sa commande.</DialogDescription>
        </DialogHeader>
        <form id={`deliver-${order.id}`} onSubmit={submit} className="space-y-3" noValidate>
          <Input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={4}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="• • • •"
            aria-label="Code de remise"
            className="h-16 text-center font-mono text-3xl tracking-[0.5em]"
          />
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button type="submit" form={`deliver-${order.id}`} size="lg" variant="module" className="w-full" disabled={transition.isPending || code.length !== 4}>
            {transition.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />} Confirmer la livraison
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────── Tournée optimisée ───────────────────────────────

const roundKey = (p: Point | null) => (p ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : 'none')

/**
 * Ma tournée : tous les arrêts des commandes en cours, dans le meilleur ordre
 * (chaque ferme avant son client), avec la route, les heures d'arrivée et la navigation GPS.
 */
function TourPanel({ orders, position, state }: { orders: Order[]; position: { lat: number; lng: number } | null; state: ShareState }) {
  const stops: TourStop[] = orders.flatMap((o) => [
    ...(o.status === 'prise_en_charge' && o.pickupLat != null && o.pickupLng != null ? [{ orderId: o.id, kind: 'ferme' as const, lat: o.pickupLat, lng: o.pickupLng, label: o.farmer.farmName || o.farmer.name }] : []),
    ...(o.deliveryLat != null && o.deliveryLng != null ? [{ orderId: o.id, kind: 'client' as const, lat: o.deliveryLat, lng: o.deliveryLng, label: `${o.client.name} · ${o.address}` }] : []),
  ])
  const missing = orders.filter((o) => o.deliveryLat == null || (o.status === 'prise_en_charge' && o.pickupLat == null)).length
  const start: Point | null = position ?? stops[0] ?? null

  const tour = useQuery({
    queryKey: ['tour', stops.map((s) => `${s.orderId}-${s.kind}`).join('|'), roundKey(start)],
    queryFn: async () => {
      const ordered = await planTour(start!, stops)
      const r = await route([start!, ...ordered])
      return { ordered, r }
    },
    enabled: Boolean(start) && stops.length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const t = tour.data
  // Temps cumulé jusqu'à chaque arrêt
  const etas = (t?.r.legsS ?? []).reduce<number[]>((list, leg) => [...list, (list.at(-1) ?? 0) + leg], [])
  const nav = t ? googleMapsUrl(position, t.ordered) : null

  return (
    <section aria-label="Ma tournée" className="mb-6 overflow-hidden rounded-2xl border bg-card/70 backdrop-blur">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-5">
        <RouteIcon className="size-5 text-energy-fg" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Ma tournée optimisée</h2>
          <p className="text-xs text-muted-foreground">
            {t ? (
              <>
                {t.ordered.length} arrêt{t.ordered.length > 1 ? 's' : ''} · {formatDistance(t.r.distanceM)} · {formatDuration(t.r.durationS)} · fin vers {arrivalTime(t.r.durationS)}
              </>
            ) : tour.isFetching ? (
              'Calcul du meilleur itinéraire…'
            ) : (
              'Ajoutez des commandes pour construire la tournée.'
            )}
          </p>
        </div>
        {nav && (
          <Button asChild variant="module" size="sm">
            <a href={nav} target="_blank" rel="noreferrer">
              <Navigation aria-hidden="true" /> Lancer la navigation
            </a>
          </Button>
        )}
      </header>

      <ShareBanner state={state} />

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <DeliveryMap
          stops={(t?.ordered ?? stops).map((s, i) => ({ ...s, n: t ? i + 1 : undefined }))}
          courier={position}
          path={t?.r.path}
          className="h-72 rounded-none border-0 lg:h-full lg:min-h-80"
        />
        <ol className="divide-y border-t lg:border-s lg:border-t-0">
          {(t?.ordered ?? []).map((s, i) => (
            <li key={`${s.orderId}-${s.kind}`} className="flex items-center gap-3 px-4 py-3">
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', s.kind === 'ferme' ? 'bg-leaf' : 'bg-water')}>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {s.kind === 'ferme' ? <Sprout className="size-3.5" aria-hidden="true" /> : <House className="size-3.5" aria-hidden="true" />}
                  {s.kind === 'ferme' ? 'Récupérer à la ferme' : 'Livrer au client'}
                </p>
                <p className="truncate text-sm font-medium">{s.label}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{arrivalTime(etas[i] ?? 0)}</span>
            </li>
          ))}
          {missing > 0 && (
            <li className="flex items-center gap-2 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              {missing} commande{missing > 1 ? 's' : ''} sans position sur la carte (ferme ou client) : utilisez l’adresse écrite.
            </li>
          )}
        </ol>
      </div>
      {t?.r.source === 'estimation' && <p className="border-t px-4 py-2 text-xs text-muted-foreground">Service d’itinéraire indisponible : distances et temps estimés à vol d’oiseau.</p>}
    </section>
  )
}

function ShareBanner({ state }: { state: ShareState }) {
  const cfg = {
    actif: { icon: LocateFixed, cls: 'bg-leaf/10 text-leaf-fg', text: 'Position partagée : vos clients et les fermes vous suivent en direct. Gardez cette page ouverte pendant la tournée.' },
    demande: { icon: LocateFixed, cls: 'bg-muted text-muted-foreground', text: 'Autorisez la localisation pour que vos clients puissent vous suivre.' },
    refuse: { icon: LocateOff, cls: 'bg-red-500/10 text-red-600 dark:text-red-400', text: 'Localisation refusée : vos clients ne peuvent pas vous suivre. Autorisez-la dans les réglages du navigateur (icône à gauche de l’adresse).' },
    indisponible: { icon: LocateOff, cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', text: 'Position GPS indisponible pour le moment (vérifiez que la localisation de l’appareil est activée).' },
    off: null,
  }[state]
  if (!cfg) return null
  return (
    <p className={cn('flex items-center gap-2 px-4 py-2 text-xs font-medium sm:px-5', cfg.cls)}>
      <cfg.icon className={cn('size-4 shrink-0', state === 'actif' && 'animate-pulse')} aria-hidden="true" /> {cfg.text}
    </p>
  )
}
