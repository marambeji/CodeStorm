import { useQuery } from '@tanstack/react-query'
import { Clock, MapPinOff, Navigation, Radio } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ON_THE_ROAD, useOrderLive, type Order } from './api'
import { DeliveryMap, type MapStop } from './live-map'
import { arrivalTime, formatDistance, formatDuration, route, type Point } from './routing'

const STALE_MS = 2 * 60_000

/** Arrondi (~100 m) : on ne recalcule l'itinéraire que si le livreur a vraiment bougé */
const roundKey = (p: Point | null | undefined) => (p ? `${p.lat.toFixed(3)},${p.lng.toFixed(3)}` : 'none')

/**
 * Suivi en direct d'une commande : position du livreur (rafraîchie toutes les 5 s),
 * trajet restant (ferme puis client) et heure d'arrivée estimée.
 */
export function LiveTracking({ order: initial, perspective }: { order: Order; perspective: 'client' | 'agriculteur' }) {
  const live = useOrderLive(initial.id, ON_THE_ROAD.includes(initial.status))
  const order = live.data ?? initial
  const courier = order.courier?.live ?? null
  const farm: Point | null = order.pickupLat != null && order.pickupLng != null ? { lat: order.pickupLat, lng: order.pickupLng } : null
  const home: Point | null = order.deliveryLat != null && order.deliveryLng != null ? { lat: order.deliveryLat, lng: order.deliveryLng } : null
  const toFarm = order.status === 'prise_en_charge'
  const farmName = order.farmer.farmName || order.farmer.name

  // Prochains arrêts du livreur pour CETTE commande
  const remaining = [toFarm ? farm : null, perspective === 'client' ? home : null].filter((p): p is Point => p !== null)
  const itinerary = useQuery({
    queryKey: ['route', order.id, order.status, roundKey(courier), remaining.map(roundKey).join('|')],
    queryFn: ({ signal }) => route([courier!, ...remaining], signal),
    enabled: Boolean(courier) && remaining.length > 0,
    staleTime: 60_000,
  })

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  const age = courier ? now - new Date(courier.at).getTime() : null
  const stale = age !== null && age > STALE_MS

  if (!ON_THE_ROAD.includes(order.status)) return null

  const stops: MapStop[] = [
    ...(farm ? [{ ...farm, kind: 'ferme' as const, label: farmName }] : []),
    ...(home && perspective === 'client' ? [{ ...home, kind: 'client' as const, label: 'Votre point de livraison' }] : []),
  ]
  const r = itinerary.data
  const toFarmS = r && toFarm ? (r.legsS[0] ?? 0) : 0

  const headline =
    perspective === 'agriculteur'
      ? toFarm
        ? `${order.courier?.name ?? 'Le livreur'} vient chercher la commande`
        : 'Commande récupérée, en route vers le client'
      : toFarm
        ? `${order.courier?.name ?? 'Le livreur'} va chercher votre commande à la ferme`
        : 'Votre commande est en route'

  return (
    <section aria-label="Suivi en direct" className="overflow-hidden rounded-xl border bg-background/40">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
        <span className={cn('flex items-center gap-1.5 text-xs font-semibold', courier && !stale ? 'text-red-500' : 'text-muted-foreground')}>
          <Radio className={cn('size-3.5', courier && !stale && 'animate-pulse')} aria-hidden="true" /> {courier && !stale ? 'EN DIRECT' : 'SUIVI'}
        </span>
        <p className="min-w-0 flex-1 text-sm font-medium">{headline}</p>
        {r && (
          <p className="flex items-center gap-1.5 text-sm" aria-live="polite">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" />
            {perspective === 'agriculteur' ? (
              toFarm ? (
                <>
                  Arrivée à la ferme vers <strong className="tabular-nums">{arrivalTime(toFarmS)}</strong>
                </>
              ) : null
            ) : (
              <>
                Arrivée vers <strong className="tabular-nums">{arrivalTime(r.durationS)}</strong>
                <span className="text-muted-foreground">
                  · {formatDuration(r.durationS)} · {formatDistance(r.distanceM)}
                </span>
              </>
            )}
          </p>
        )}
      </div>

      {courier || stops.length ? (
        <DeliveryMap stops={stops} courier={courier} path={r?.path} className="h-64 rounded-none border-x-0 border-b-0 sm:h-72" />
      ) : null}

      <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
        {!courier ? (
          <>
            <MapPinOff className="size-3.5" aria-hidden="true" /> Position du livreur pas encore disponible : elle apparaîtra dès qu’il ouvrira sa tournée.
          </>
        ) : stale ? (
          <>
            <MapPinOff className="size-3.5" aria-hidden="true" /> Dernière position il y a {Math.round((age ?? 0) / 60_000)} min (réseau du livreur coupé ?).
          </>
        ) : (
          <>
            <Navigation className="size-3.5" aria-hidden="true" /> Position mise à jour il y a {Math.max(1, Math.round((age ?? 0) / 1000))} s
            {r?.source === 'estimation' && ' · temps estimé à vol d’oiseau (service d’itinéraire indisponible)'}
          </>
        )}
      </p>
    </section>
  )
}
