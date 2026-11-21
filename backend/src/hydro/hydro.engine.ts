import type { Feature, FeatureCollection, Polygon } from 'geojson'

/**
 * Moteur HydroMap.
 *
 * Les indices satellitaires viennent d'un "fournisseur de données" (interface HydroDataProvider).
 * - SimulatedHydroProvider : données réalistes générées pour la démo (aucune connexion requise)
 * - Pour la production : un Sentinel2Provider (Copernicus / Google Earth Engine) implémentera la
 *   même interface (NDVI = (B8 - B4) / (B8 + B4), NDWI = (B3 - B8) / (B3 + B8)) sans rien changer d'autre.
 *
 * Le stress hydrique et la prévision sont calculés ici par des formules (pas par le LLM).
 */

export interface ZoneProps {
  id: string
  name: string
  landUse: string
  areaHa: number
  /** Indice de végétation (-1 → 1), plus haut = végétation plus vigoureuse */
  ndvi: number
  /** Indice d'eau (-1 → 1), plus haut = plus d'eau dans la végétation / le sol */
  ndwi: number
  /** Écart des pluies des 90 derniers jours à la normale (en %, négatif = déficit) */
  rainfallAnomaly: number
  /** Évolution du niveau de la nappe (m/an, négatif = baisse) */
  groundwaterTrend: number
}

export type StressLevel = 'faible' | 'modéré' | 'élevé' | 'critique'
export interface DailyPoint {
  date: string // AAAA-MM-JJ
  stress: number
}

export interface HydroDataProvider {
  readonly source: string
  zones(): Feature<Polygon, ZoneProps>[]
  /** Historique quotidien de l'indice de stress (le plus ancien en premier) */
  history(zoneId: string, days: number, today: Date): DailyPoint[]
}

// ─────────────────────────────── Formules ───────────────────────────────

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))
const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d

/**
 * Indice de stress hydrique (0 = aucun stress, 1 = stress extrême) combinant :
 * végétation faible (NDVI), manque d'eau (NDWI) et déficit de pluie.
 */
export function stressIndex(p: Pick<ZoneProps, 'ndvi' | 'ndwi' | 'rainfallAnomaly'>): number {
  const vegetation = 1 - clamp((p.ndvi - 0.1) / 0.6) // NDVI 0,1 → stress 1 ; 0,7 → stress 0
  const water = 1 - clamp((p.ndwi + 0.3) / 0.6) // NDWI -0,3 → 1 ; 0,3 → 0
  const rain = clamp(-p.rainfallAnomaly / 60) // -60 % de pluie → 1
  return round(0.45 * vegetation + 0.35 * water + 0.2 * rain)
}

export function stressLevel(s: number): StressLevel {
  if (s < 0.3) return 'faible'
  if (s < 0.5) return 'modéré'
  if (s < 0.7) return 'élevé'
  return 'critique'
}

/**
 * Prévision sur `horizon` jours : tendance linéaire (moindres carrés sur l'historique)
 * amortie, avec un intervalle d'incertitude qui grandit avec l'horizon (√t).
 * Simple, explicable et suffisant pour orienter une décision.
 */
export function forecast(history: DailyPoint[], horizon = 30) {
  const ys = history.map((p) => p.stress)
  const n = ys.length
  const xMean = (n - 1) / 2
  const yMean = ys.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  ys.forEach((y, x) => {
    num += (x - xMean) * (y - yMean)
    den += (x - xMean) ** 2
  })
  const slope = den ? num / den : 0
  const residuals = ys.map((y, x) => y - (yMean + slope * (x - xMean)))
  const sigma = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, n - 2))
  const last = ys[n - 1]
  const lastDate = new Date(`${history[n - 1].date}T00:00:00Z`)

  const points = Array.from({ length: horizon }, (_, i) => {
    const t = i + 1
    const value = clamp(last + slope * t * 0.8) // tendance amortie de 20 %
    const spread = sigma * 1.28 * Math.sqrt(t) * 0.6 // ~80 % d'intervalle de confiance
    const date = new Date(lastDate.getTime() + t * 86_400_000).toISOString().slice(0, 10)
    return { date, stress: round(value), low: round(clamp(value - spread)), high: round(clamp(value + spread)) }
  })
  return { points, slopePerMonth: round(slope * 30), trend: slope * 30 > 0.03 ? 'hausse' : slope * 30 < -0.03 ? 'baisse' : 'stable' }
}

// ─────────────────────────────── Données simulées ───────────────────────────────

/** Générateur pseudo-aléatoire reproductible (même graine → mêmes données) */
function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const hexagon = (lng: number, lat: number, rKm: number): Polygon => {
  const dLat = rKm / 110.574
  const dLng = rKm / (111.32 * Math.cos((lat * Math.PI) / 180))
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i
    return [Math.round((lng + dLng * Math.cos(a)) * 1e5) / 1e5, Math.round((lat + dLat * Math.sin(a)) * 1e5) / 1e5]
  })
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
}

/**
 * 15 zones hexagonales sur une plaine agricole semi-aride (région de Kairouan, Tunisie),
 * avec des indices cohérents : plus on va vers le sud-ouest, plus c'est sec.
 */
export class SimulatedHydroProvider implements HydroDataProvider {
  readonly source = 'Données simulées (structure compatible Sentinel-2)'
  private cache: Feature<Polygon, ZoneProps>[] | null = null

  zones() {
    if (this.cache) return this.cache
    // Noms rangés du nord au sud, d'ouest en est (3 zones par rangée)
    const names = [
      'Plateau Nord-Ouest', 'Plaine Nord', 'Maraîchage Nord',
      'Collines Ouest', 'Barrage Amont', 'Coteaux Est',
      'Steppe Ouest', 'Bassin Central', 'Vallée Est',
      'Oued El Hdjal', 'Oliveraies Centre', 'Sebkha',
      'Parcours Sud-Ouest', 'Plaine Sud', 'Périmètre irrigué Sud',
    ]
    const uses = ['Céréales', 'Oliveraies', 'Maraîchage', 'Parcours', 'Arboriculture']
    const rand = seeded(42)
    const center = { lng: 9.95, lat: 35.62 }
    const r = 4.2 // km
    const features: Feature<Polygon, ZoneProps>[] = []
    let i = 0
    for (let row = 2; row >= -2; row--) {
      for (let col = -1; col <= 1; col++) {
        const lng = center.lng + ((col * 1.5 * r) / (111.32 * Math.cos((center.lat * Math.PI) / 180))) * 1.02
        const lat = center.lat + ((row * Math.sqrt(3) * r + (col % 2 ? (Math.sqrt(3) / 2) * r : 0)) / 110.574) * 1.02
        // Gradient : sec au sud-ouest, plus humide au nord-est et près du barrage
        const dryness = clamp(0.5 - row * 0.14 - col * 0.12 + (rand() - 0.5) * 0.25)
        const name = names[i]
        const irrigated = /irrigué|Barrage|Maraîchage/.test(name)
        const ndvi = round(clamp(0.72 - dryness * 0.55 + (irrigated ? 0.12 : 0) + (rand() - 0.5) * 0.05, 0.05, 0.85), 2)
        const ndwi = round(clamp(0.28 - dryness * 0.55 + (irrigated ? 0.1 : 0) + (rand() - 0.5) * 0.05, -0.4, 0.4), 2)
        features.push({
          type: 'Feature',
          geometry: hexagon(lng, lat, r),
          properties: {
            id: `z${String(i + 1).padStart(2, '0')}`,
            name,
            landUse: name === 'Sebkha' ? 'Zone humide salée' : irrigated ? 'Maraîchage irrigué' : uses[Math.floor(rand() * uses.length)],
            areaHa: Math.round(((3 * Math.sqrt(3)) / 2) * r * r * 100),
            ndvi,
            ndwi,
            rainfallAnomaly: Math.round(-10 - dryness * 45 + (rand() - 0.5) * 10),
            groundwaterTrend: round(-0.2 - dryness * 1.4 + (irrigated ? -0.3 : 0), 2),
          },
        })
        i++
      }
    }
    this.cache = features
    return features
  }

  history(zoneId: string, days: number, today: Date) {
    const zone = this.zones().find((z) => z.properties.id === zoneId)
    if (!zone) return []
    const current = stressIndex(zone.properties)
    const rand = seeded(Number(zoneId.slice(1)) * 97)
    // Les zones sèches s'assèchent encore (fin d'été), les zones irriguées sont stables
    const drift = (current - 0.4) * 0.004
    return Array.from({ length: days }, (_, k) => {
      const back = days - 1 - k
      const date = new Date(today.getTime() - back * 86_400_000).toISOString().slice(0, 10)
      const wave = Math.sin((k / days) * Math.PI * 3) * 0.02
      return { date, stress: round(clamp(current - drift * back + wave + (rand() - 0.5) * 0.03)) }
    })
  }
}

/** FeatureCollection prête pour la carte : indices + stress calculé + niveau */
export function zonesCollection(provider: HydroDataProvider): FeatureCollection<Polygon, ZoneProps & { stress: number; level: StressLevel }> {
  return {
    type: 'FeatureCollection',
    features: provider.zones().map((f) => {
      const stress = stressIndex(f.properties)
      return { ...f, properties: { ...f.properties, stress, level: stressLevel(stress) } }
    }),
  }
}
