/**
 * Optimisation des itinéraires de la supply chain (collecte des lots dans les fermes,
 * livraison aux distributeurs) : plus proche voisin, puis amélioration 2-opt.
 * Distances à vol d'oiseau × 1,3 pour approcher la route ; vitesse moyenne d'un camion : 50 km/h.
 */

export interface Point {
  lat: number
  lng: number
}

const ROAD_FACTOR = 1.3
const SPEED_KMH = 50

export function haversineKm(a: Point, b: Point): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h)) * ROAD_FACTOR
}

/** Longueur (km) d'un trajet qui part de `start` et visite les points dans l'ordre */
export function pathKm(start: Point, stops: Point[], ret = false): number {
  let km = 0
  let cur = start
  for (const s of stops) {
    km += haversineKm(cur, s)
    cur = s
  }
  return ret && stops.length ? km + haversineKm(cur, start) : km
}

export interface Optimized {
  /** Indices des arrêts dans l'ordre de passage optimisé */
  order: number[]
  distanceKm: number
  durationMin: number
  /** Distance si on suit l'ordre saisi */
  naiveKm: number
  savedKm: number
  savedPct: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function optimizeRoute(start: Point, stops: Point[], returnToStart = false): Optimized {
  const n = stops.length
  const cost = (order: number[]) =>
    pathKm(
      start,
      order.map((i) => stops[i]),
      returnToStart,
    )

  // 1. Plus proche voisin
  const order: number[] = []
  const left = new Set(stops.map((_, i) => i))
  let cur: Point = start
  while (left.size) {
    let best = -1
    for (const i of left) if (best === -1 || haversineKm(cur, stops[i]) < haversineKm(cur, stops[best])) best = i
    order.push(best)
    left.delete(best)
    cur = stops[best]
  }

  // 2. 2-opt : on inverse des segments tant que le trajet raccourcit
  let bestOrder = order
  let bestCost = cost(order)
  let improved = n > 2
  for (let pass = 0; improved && pass < 50; pass++) {
    improved = false
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const cand = [...bestOrder.slice(0, i), ...bestOrder.slice(i, j + 1).reverse(), ...bestOrder.slice(j + 1)]
        const c = cost(cand)
        if (c < bestCost - 1e-9) {
          bestOrder = cand
          bestCost = c
          improved = true
        }
      }
    }
  }

  const naiveKm = cost(stops.map((_, i) => i))
  const saved = Math.max(0, naiveKm - bestCost)
  return {
    order: bestOrder,
    distanceKm: r1(bestCost),
    durationMin: Math.round((bestCost / SPEED_KMH) * 60),
    naiveKm: r1(naiveKm),
    savedKm: r1(saved),
    savedPct: naiveKm > 0 ? Math.round((saved / naiveKm) * 100) : 0,
  }
}
