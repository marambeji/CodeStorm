import turfArea from '@turf/area'
import turfBbox from '@turf/bbox'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import turfCentroid from '@turf/centroid'
import { feature, point } from '@turf/helpers'
import turfKinks from '@turf/kinks'
import turfLength from '@turf/length'
import type { Polygon, Position } from 'geojson'

/**
 * Moteur d'estimation de TerraCalc.
 *
 * TOUS les chiffres (surface, nombre d'arbres, eau, production, argent, CO2) sont calculés
 * ici par des formules déterministes et des données de référence (table Species).
 * Le LLM n'intervient qu'APRÈS, pour expliquer ces chiffres et donner des conseils.
 *
 * Fonctions pures (aucune base de données) → faciles à tester (voir estimation.spec.ts).
 */

export type Irrigation = 'goutte-a-goutte' | 'aspersion' | 'gravitaire' | 'pluvial'
export type Stage = 'futur' | 'jeune' | 'adulte' | 'mature' | 'declin'

/** Données d'une espèce (même forme que la table Prisma, champs facultatifs à null) */
export interface SpeciesRef {
  id: string
  name: string
  kind: string
  droughtTolerance: string
  rowSpacingM: number | null
  treeSpacingM: number | null
  waterM3PerTreeYear: number | null
  firstProductionAge: number | null
  fullProductionAge: number | null
  fullYieldKgPerTree: number | null
  lifespanYears: number | null
  plantCostEur: number | null
  maintenanceEurPerTreeYr: number | null
  co2KgPerTreeYear: number | null
  yieldKgPerHa: number | null
  waterM3PerHaYear: number | null
  costEurPerHa: number | null
  co2KgPerHaYear: number | null
  pricePerKgEur: number
}

export interface EstimateInput {
  polygon: Polygon
  species: SpeciesRef
  /** Année de plantation. null = terrain vide, plantation prévue cette année. */
  plantingYear: number | null
  rowSpacingM?: number | null
  treeSpacingM?: number | null
  irrigation: Irrigation
  pricePerKg?: number | null
  currentYear: number
}

// ─────────────────────────── Constantes de référence ───────────────────────────

/** Efficience des systèmes d'irrigation (part de l'eau réellement utilisée par la plante) */
export const IRRIGATION_EFFICIENCY: Record<Irrigation, number> = {
  'goutte-a-goutte': 0.9,
  aspersion: 0.75,
  gravitaire: 0.6,
  pluvial: 1, // pas d'irrigation : la pluie couvre ce qu'elle peut
}
/** Coût d'installation du réseau d'irrigation (€/ha) */
export const IRRIGATION_COST_PER_HA: Record<Irrigation, number> = {
  'goutte-a-goutte': 2500,
  aspersion: 1800,
  gravitaire: 600,
  pluvial: 0,
}
/** Préparation du sol avant plantation (€/ha) */
export const SOIL_PREPARATION_PER_HA = 600
/** Sans irrigation, le rendement baisse fortement en climat sec */
export const RAINFED_YIELD_FACTOR = { tree: 0.6, crop: 0.55 }

export const LIMITS = { minAreaM2: 50, maxAreaM2: 50_000_000, maxPreviewPoints: 5000, maxGridCells: 400_000 }

const M_PER_DEG_LAT = 110_574
const M_PER_DEG_LNG_EQUATOR = 111_320

// ─────────────────────────────── Géométrie ───────────────────────────────

export class InvalidPolygonError extends Error {}

/**
 * Vérifie et normalise un polygone GeoJSON envoyé par le client.
 * Lève InvalidPolygonError avec un message clair si quelque chose ne va pas.
 */
export function validatePolygon(input: unknown): Polygon {
  const geo = input as Partial<Polygon> | null
  if (!geo || geo.type !== 'Polygon' || !Array.isArray(geo.coordinates) || !Array.isArray(geo.coordinates[0])) {
    throw new InvalidPolygonError('Le terrain doit être un polygone GeoJSON (type "Polygon").')
  }
  const ring = geo.coordinates[0].map((p) => {
    if (!Array.isArray(p) || p.length < 2) throw new InvalidPolygonError('Chaque point doit être [longitude, latitude].')
    const [lng, lat] = p
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
      throw new InvalidPolygonError('Un point a des coordonnées invalides.')
    }
    return [lng, lat] as Position
  })
  // On ferme l'anneau s'il ne l'est pas (premier point = dernier point)
  const [first, last] = [ring[0], ring[ring.length - 1]]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  if (ring.length < 4) throw new InvalidPolygonError('Il faut au moins 3 points pour délimiter un terrain.')

  const polygon: Polygon = { type: 'Polygon', coordinates: [ring] }
  if (turfKinks(polygon).features.length > 0) {
    throw new InvalidPolygonError('Le contour se croise lui-même. Déplacez les points pour former un contour simple.')
  }
  const area = turfArea(polygon)
  if (area < LIMITS.minAreaM2) throw new InvalidPolygonError('Le terrain est trop petit (minimum 50 m²).')
  if (area > LIMITS.maxAreaM2) throw new InvalidPolygonError('Le terrain est trop grand (maximum 5 000 ha).')
  return polygon
}

export function measurePolygon(polygon: Polygon) {
  const areaM2 = turfArea(polygon)
  const [lng, lat] = turfCentroid(polygon).geometry.coordinates
  return {
    areaM2: round(areaM2, 1),
    areaHa: round(areaM2 / 10_000, 4),
    perimeterM: round(turfLength(feature(polygon), { units: 'meters' }), 1),
    centroid: [round(lat, 6), round(lng, 6)] as [number, number],
    vertexCount: polygon.coordinates[0].length - 1,
  }
}

/**
 * Plantation en grille : un arbre tous les `treeSpacingM` sur le rang,
 * des rangs tous les `rowSpacingM`. On ne garde que les arbres DANS le polygone.
 * Projection locale équirectangulaire : largement assez précise à l'échelle d'une parcelle.
 *
 * Renvoie le nombre EXACT d'arbres + des points pour l'aperçu sur la carte
 * (au-delà de `maxPoints`, une grille simplifiée couvrant tout le terrain).
 */
export function plantingGrid(polygon: Polygon, rowSpacingM: number, treeSpacingM: number, maxPoints = LIMITS.maxPreviewPoints) {
  const [minLng, minLat, maxLng, maxLat] = turfBbox(polygon)
  const lat0 = (minLat + maxLat) / 2
  const mPerDegLng = M_PER_DEG_LNG_EQUATOR * Math.cos((lat0 * Math.PI) / 180)
  const rows = Math.floor(((maxLat - minLat) * M_PER_DEG_LAT) / rowSpacingM) + 1
  const cols = Math.floor(((maxLng - minLng) * mPerDegLng) / treeSpacingM) + 1

  // Très grand terrain + petit espacement : on évite de tester des millions de points
  // et on passe à une estimation par la surface.
  if (rows * cols > LIMITS.maxGridCells) {
    const count = Math.floor(turfArea(polygon) / (rowSpacingM * treeSpacingM))
    return { count, points: [] as [number, number][], truncated: true, previewScale: 0, method: 'surface' as const }
  }

  // Parcourt la grille (un point tous les `row` m en latitude, `tree` m en longitude)
  const walk = (row: number, tree: number, onPoint?: (p: [number, number]) => void) => {
    const dLat = row / M_PER_DEG_LAT
    const dLng = tree / mPerDegLng
    let n = 0
    for (let lat = minLat + dLat / 2; lat <= maxLat; lat += dLat) {
      for (let lng = minLng + dLng / 2; lng <= maxLng; lng += dLng) {
        if (booleanPointInPolygon(point([lng, lat]), polygon)) {
          n++
          onPoint?.([round(lat, 7), round(lng, 7)])
        }
      }
    }
    return n
  }

  // 1. Nombre EXACT d'arbres, avec l'espacement choisi
  const points: [number, number][] = []
  const count = walk(rowSpacingM, treeSpacingM, (p) => points.length <= maxPoints && points.push(p))
  if (count <= maxPoints) return { count, points, truncated: false, previewScale: 1, method: 'grille' as const }

  // 2. Trop d'arbres pour l'aperçu : grille simplifiée sur TOUT le terrain
  //    (1 point affiché = previewScale arbres) plutôt que de couper les derniers rangs.
  const factor = Math.ceil(Math.sqrt(count / maxPoints))
  const preview: [number, number][] = []
  walk(rowSpacingM * factor, treeSpacingM * factor, (p) => preview.push(p))
  return { count, points: preview, truncated: true, previewScale: factor * factor, method: 'grille' as const }
}

// ─────────────────────────────── Agronomie ───────────────────────────────

/**
 * Part du rendement maximal produite par un arbre selon son âge (0 → 1) :
 *  - 0 avant la première récolte
 *  - montée progressive (10 % → 100 %) jusqu'à la pleine production
 *  - plateau, puis déclin dans les 15 % finaux de la durée de vie
 */
export function yieldFactor(age: number, s: SpeciesRef): number {
  const first = s.firstProductionAge ?? 0
  const full = Math.max(s.fullProductionAge ?? first + 1, first + 1)
  const life = s.lifespanYears ?? 50
  if (age < first) return 0
  if (age < full) return 0.1 + (0.9 * (age - first)) / (full - first)
  const declineStart = life * 0.85
  if (age <= declineStart) return 1
  if (age <= life) return 1 - (0.5 * (age - declineStart)) / (life - declineStart)
  return 0.4
}

/** Besoin en eau et CO2 grandissent avec l'arbre : 30 % à la plantation → 100 % adulte */
export function maturityFactor(age: number, s: SpeciesRef): number {
  const full = s.fullProductionAge ?? 8
  return Math.min(1, 0.3 + (0.7 * Math.max(age, 0)) / full)
}

export function growthStage(age: number, s: SpeciesRef): Stage {
  if (age < 0) return 'futur'
  if (age < (s.firstProductionAge ?? 0)) return 'jeune'
  if (age < (s.fullProductionAge ?? 0)) return 'adulte'
  if (age <= (s.lifespanYears ?? 50) * 0.85) return 'mature'
  return 'declin'
}

// ─────────────────────────────── Estimation ───────────────────────────────

export function estimate(input: EstimateInput) {
  const { polygon, species: s, irrigation, currentYear } = input
  const geometry = measurePolygon(polygon)
  const ha = geometry.areaM2 / 10_000
  const price = input.pricePerKg ?? s.pricePerKgEur
  const efficiency = IRRIGATION_EFFICIENCY[irrigation]
  const rainfed = irrigation === 'pluvial'
  const isTree = s.kind === 'tree'

  // Année de plantation : "terrain vide" = plantation cette année
  const plantedYear = input.plantingYear ?? currentYear
  const ageNow = currentYear - plantedYear
  const startYear = Math.max(currentYear, plantedYear)

  const base = {
    geometry,
    species: { id: s.id, name: s.name, kind: s.kind },
    inputs: {
      plantingYear: input.plantingYear,
      plantedYear,
      irrigation,
      pricePerKg: price,
      rowSpacingM: isTree ? (input.rowSpacingM ?? s.rowSpacingM) : null,
      treeSpacingM: isTree ? (input.treeSpacingM ?? s.treeSpacingM) : null,
    },
  }

  if (!isTree) {
    // ── Culture annuelle (ex. blé) : tout se calcule à l'hectare ──
    const rain = rainfed ? RAINFED_YIELD_FACTOR.crop : 1
    const kg = ha * (s.yieldKgPerHa ?? 0) * rain
    const campaignCost = ha * (s.costEurPerHa ?? 0)
    const need = ha * (s.waterM3PerHaYear ?? 0)
    const revenue = kg * price
    const projection = range(10).map((i) => ({ year: startYear + i, age: null, kg: round(kg), revenueEur: round(revenue) }))
    return {
      ...base,
      trees: null,
      age: null,
      stage: null,
      production: { kgPerYear: round(kg), kgPerYearFull: round(kg), kgPerTree: null },
      projection,
      water: waterBlock(need, need, rainfed ? 0 : need / efficiency, ha, irrigation, s),
      economics: {
        pricePerKg: price,
        revenuePerYear: round(revenue),
        installationCost: round(campaignCost),
        maintenancePerYear: round(campaignCost),
        netPerYear: round(revenue - campaignCost),
        paybackYears: revenue > campaignCost ? 1 : null,
      },
      co2: { kgPerYear: round(ha * (s.co2KgPerHaYear ?? 0)) },
    }
  }

  // ── Arbres / vigne ──
  const rowM = base.inputs.rowSpacingM ?? 6
  const treeM = base.inputs.treeSpacingM ?? 5
  const grid = plantingGrid(polygon, rowM, treeM)
  const trees = grid.count
  const rain = rainfed ? RAINFED_YIELD_FACTOR.tree : 1
  const perTreeFull = (s.fullYieldKgPerTree ?? 0) * rain
  const kgAt = (age: number) => trees * perTreeFull * yieldFactor(age, s)

  const maintenance = trees * (s.maintenanceEurPerTreeYr ?? 0)
  const installationCost = trees * (s.plantCostEur ?? 0) + ha * (IRRIGATION_COST_PER_HA[irrigation] + SOIL_PREPARATION_PER_HA)

  const projection = range(10).map((i) => {
    const year = startYear + i
    const age = year - plantedYear
    const kg = kgAt(age)
    return { year, age, kg: round(kg), revenueEur: round(kg * price) }
  })

  // Retour sur investissement : on simule depuis la plantation (âge 0) jusqu'à 40 ans
  let cumulative = -installationCost
  let paybackYears: number | null = null
  for (let age = 0; age < 40; age++) {
    cumulative += kgAt(age) * price - maintenance
    if (cumulative >= 0) {
      paybackYears = age + 1
      break
    }
  }

  const maturity = maturityFactor(Math.max(ageNow, 0), s)
  const needNow = trees * (s.waterM3PerTreeYear ?? 0) * maturity
  const needAdult = trees * (s.waterM3PerTreeYear ?? 0)
  const kgNow = ageNow >= 0 ? kgAt(ageNow) : 0

  return {
    ...base,
    trees: {
      count: trees,
      densityPerHa: round(trees / ha, 1),
      points: grid.points,
      truncated: grid.truncated,
      previewScale: grid.previewScale,
      method: grid.method,
    },
    age: ageNow,
    stage: growthStage(ageNow, s),
    production: { kgPerYear: round(kgNow), kgPerYearFull: round(trees * perTreeFull), kgPerTree: round(perTreeFull * yieldFactor(Math.max(ageNow, 0), s), 1) },
    projection,
    water: waterBlock(needNow, needAdult, rainfed ? 0 : needNow / efficiency, ha, irrigation, s),
    economics: {
      pricePerKg: price,
      revenuePerYear: round(kgNow * price),
      installationCost: round(installationCost),
      maintenancePerYear: round(maintenance),
      netPerYear: round(kgNow * price - maintenance),
      paybackYears,
    },
    co2: { kgPerYear: round(trees * (s.co2KgPerTreeYear ?? 0) * maturity) },
  }
}

export type Estimate = ReturnType<typeof estimate>

/** Bloc "eau" + conseil d'irrigation déterministe (le LLM pourra le reformuler) */
function waterBlock(needM3: number, needAdultM3: number, irrigationM3: number, ha: number, irrigation: Irrigation, s: SpeciesRef) {
  let advice: string
  if (irrigation === 'pluvial') {
    advice =
      s.droughtTolerance === 'faible'
        ? `${s.name} supporte mal la sécheresse : sans irrigation, prévoyez au minimum un goutte-à-goutte d'appoint en été.`
        : `Conduite sans irrigation possible, mais le rendement sera environ 40 % plus bas. Un goutte-à-goutte d'appoint sécurise la récolte.`
  } else if (irrigation === 'gravitaire') {
    advice = `Passer au goutte-à-goutte économiserait environ ${round((1 - 0.6 / 0.9) * 100)} % de l'eau pompée, soit ${fmt(needM3 / 0.6 - needM3 / 0.9)} m³ par an.`
  } else if (irrigation === 'aspersion') {
    advice = `Le goutte-à-goutte réduirait l'eau pompée d'environ ${round((1 - 0.75 / 0.9) * 100)} % et limiterait les maladies du feuillage.`
  } else {
    advice = 'Bon choix : arrosez tôt le matin, paillez le pied des arbres et augmentez les apports progressivement en été.'
  }
  return {
    needM3PerYear: round(needM3),
    needM3PerYearAdult: round(needAdultM3),
    irrigationM3PerYear: round(irrigationM3),
    m3PerHa: ha > 0 ? round(irrigationM3 / ha) : 0,
    efficiency: IRRIGATION_EFFICIENCY[irrigation],
    advice,
  }
}

// ─────────────────────────────── Utilitaires ───────────────────────────────

function round(n: number, decimals = 0) {
  const f = 10 ** decimals
  return Math.round(n * f) / f
}
function range(n: number) {
  return Array.from({ length: n }, (_, i) => i)
}
function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n).replace(/\u202f/g, '\u00a0')
}
