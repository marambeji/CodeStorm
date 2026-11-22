/**
 * Itinéraires routiers pour le suivi et la tournée des livreurs.
 * Service : OSRM (OpenStreetMap, gratuit, sans clé). S'il ne répond pas, on se rabat sur
 * la distance à vol d'oiseau (× 1,3 pour approcher la route) à 35 km/h : l'appli reste utilisable.
 */

export interface Point {
  lat: number
  lng: number
}

export interface Route {
  /** Tracé [lat, lng] à dessiner sur la carte */
  path: [number, number][]
  distanceM: number
  durationS: number
  /** Durée de chaque tronçon (entre deux points successifs) */
  legsS: number[]
  source: 'osrm' | 'estimation'
}

const OSRM = 'https://router.project-osrm.org'
const FALLBACK_SPEED = 35 / 3.6 // m/s
const ROAD_FACTOR = 1.3

export function haversineM(a: Point, b: Point) {
  const R = 6_371_000
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const coords = (pts: Point[]) => pts.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')

function estimate(points: Point[]): Route {
  const legsM = points.slice(1).map((p, i) => haversineM(points[i], p) * ROAD_FACTOR)
  const distanceM = legsM.reduce((s, d) => s + d, 0)
  return { path: points.map((p) => [p.lat, p.lng]), distanceM, durationS: distanceM / FALLBACK_SPEED, legsS: legsM.map((d) => d / FALLBACK_SPEED), source: 'estimation' }
}

/** Itinéraire routier passant par tous les points, dans l'ordre */
export async function route(points: Point[], signal?: AbortSignal): Promise<Route> {
  if (points.length < 2) return { path: points.map((p) => [p.lat, p.lng]), distanceM: 0, durationS: 0, legsS: [], source: 'estimation' }
  try {
    const res = await fetch(`${OSRM}/route/v1/driving/${coords(points)}?overview=full&geometries=geojson`, { signal: signal ?? AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    const d = (await res.json()) as { code: string; routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] }; legs: { duration: number }[] }[] }
    const r = d.routes?.[0]
    if (d.code !== 'Ok' || !r) throw new Error(d.code)
    return { path: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]), distanceM: r.distance, durationS: r.duration, legsS: r.legs.map((l) => l.duration), source: 'osrm' }
  } catch (e) {
    if ((e as Error).name === 'AbortError' && signal?.aborted) throw e
    return estimate(points)
  }
}

/** Matrice des durées (s) entre tous les points */
async function durationMatrix(points: Point[]): Promise<number[][]> {
  try {
    const res = await fetch(`${OSRM}/table/v1/driving/${coords(points)}?annotations=duration`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(String(res.status))
    const d = (await res.json()) as { code: string; durations?: (number | null)[][] }
    if (d.code !== 'Ok' || !d.durations) throw new Error(d.code)
    return d.durations.map((row, i) => row.map((v, j) => v ?? (haversineM(points[i], points[j]) * ROAD_FACTOR) / FALLBACK_SPEED))
  } catch {
    return points.map((a) => points.map((b) => (haversineM(a, b) * ROAD_FACTOR) / FALLBACK_SPEED))
  }
}

// ─────────────────────────────── Tournée ───────────────────────────────

export interface Stop extends Point {
  orderId: string
  kind: 'ferme' | 'client'
  label: string
}

/**
 * Ordre de passage de la tournée : on part de la position du livreur et on va toujours
 * à l'arrêt le plus proche (en temps de route) parmi ceux autorisés — la ferme d'une commande
 * doit être visitée avant son client. Puis on améliore l'ordre par échanges (2-opt) tant que
 * la contrainte ferme → client reste respectée.
 */
export async function planTour(start: Point, stops: Stop[]): Promise<Stop[]> {
  if (stops.length <= 1) return stops
  const points = [start, ...stops]
  const m = await durationMatrix(points)
  const cost = (order: number[]) => order.reduce((s, idx, i) => s + m[i === 0 ? 0 : order[i - 1]][idx], 0)
  const valid = (order: number[]) =>
    order.every((idx, pos) => {
      const s = stops[idx - 1]
      if (s.kind !== 'client') return true
      const farm = stops.findIndex((x) => x.orderId === s.orderId && x.kind === 'ferme')
      return farm === -1 || order.indexOf(farm + 1) < pos
    })

  // 1. Plus proche voisin, sous contrainte (le client seulement après sa ferme)
  const farmOf = (idx: number) => {
    const s = stops[idx - 1]
    const f = s.kind === 'client' ? stops.findIndex((x) => x.orderId === s.orderId && x.kind === 'ferme') : -1
    return f === -1 ? null : f + 1
  }
  const order: number[] = []
  const left = new Set(stops.map((_, i) => i + 1))
  let cur = 0
  while (left.size) {
    let best = -1
    for (const idx of left) {
      const farm = farmOf(idx)
      if (farm !== null && !order.includes(farm)) continue
      if (best === -1 || m[cur][idx] < m[cur][best]) best = idx
    }
    order.push(best)
    left.delete(best)
    cur = best
  }

  // 2. Amélioration 2-opt
  let improved = true
  let bestOrder = order
  let bestCost = cost(order)
  for (let pass = 0; improved && pass < 20; pass++) {
    improved = false
    for (let i = 0; i < bestOrder.length - 1; i++) {
      for (let j = i + 1; j < bestOrder.length; j++) {
        const cand = [...bestOrder.slice(0, i), ...bestOrder.slice(i, j + 1).reverse(), ...bestOrder.slice(j + 1)]
        const c = cost(cand)
        if (c < bestCost - 1 && valid(cand)) {
          bestOrder = cand
          bestCost = c
          improved = true
        }
      }
    }
  }
  return bestOrder.map((idx) => stops[idx - 1])
}

// ─────────────────────────────── Formats ───────────────────────────────

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`)

export function formatDuration(s: number) {
  const min = Math.max(1, Math.round(s / 60))
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

export const arrivalTime = (s: number) => new Date(Date.now() + s * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** Lien Google Maps avec tous les arrêts (ouvre la navigation GPS sur le téléphone) */
export function googleMapsUrl(origin: Point | null, stops: Point[]) {
  if (!stops.length) return null
  const fmt = (p: Point) => `${p.lat},${p.lng}`
  const dest = stops[stops.length - 1]
  const params = new URLSearchParams({ api: '1', destination: fmt(dest), travelmode: 'driving' })
  if (origin) params.set('origin', fmt(origin))
  if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).map(fmt).join('|'))
  return `https://www.google.com/maps/dir/?${params}`
}
