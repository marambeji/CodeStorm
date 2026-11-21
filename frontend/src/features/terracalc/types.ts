import type { Polygon } from 'geojson'

/** Types partagés avec le backend (src/terrain/estimation.ts côté NestJS) */

export type Irrigation = 'goutte-a-goutte' | 'aspersion' | 'gravitaire' | 'pluvial'
export type Stage = 'futur' | 'jeune' | 'adulte' | 'mature' | 'declin'
export type LatLng = [number, number]

export interface Species {
  id: string
  name: string
  kind: 'tree' | 'crop'
  description: string
  climate: string
  droughtTolerance: 'faible' | 'moyenne' | 'élevée'
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
  /** Rendement d'un arbre (kg/an) à quelques âges clés, calculé par le backend */
  yieldCurve: { age: number; kg: number }[]
}

export interface CropConfig {
  speciesId: string
  plantingYear: number | null
  rowSpacingM: number | null
  treeSpacingM: number | null
  irrigation: Irrigation
  pricePerKg: number | null
}

export interface Estimate {
  geometry: { areaM2: number; areaHa: number; perimeterM: number; centroid: LatLng; vertexCount: number }
  species: { id: string; name: string; kind: string }
  inputs: {
    plantingYear: number | null
    plantedYear: number
    irrigation: Irrigation
    pricePerKg: number
    rowSpacingM: number | null
    treeSpacingM: number | null
  }
  trees: {
    count: number
    densityPerHa: number
    points: LatLng[]
    truncated: boolean
    /** Aperçu simplifié : 1 point affiché = previewScale arbres (0 = pas d'aperçu) */
    previewScale: number
    method: 'grille' | 'surface'
  } | null
  age: number | null
  stage: Stage | null
  production: { kgPerYear: number; kgPerYearFull: number; kgPerTree: number | null }
  projection: { year: number; age: number | null; kg: number; revenueEur: number }[]
  water: {
    needM3PerYear: number
    needM3PerYearAdult: number
    irrigationM3PerYear: number
    m3PerHa: number
    efficiency: number
    advice: string
  }
  economics: {
    pricePerKg: number
    revenuePerYear: number
    installationCost: number
    maintenancePerYear: number
    netPerYear: number
    paybackYears: number | null
  }
  co2: { kgPerYear: number }
  ai: { summary: string; tips: string[]; confidence: number; source: 'mock' | 'llm' }
  disclaimer: string
  computedAt: string
}

export interface Terrain {
  id: string
  name: string
  polygon: Polygon
  areaM2: number
  perimeterM: number
  centroidLat: number
  centroidLng: number
  speciesId: string | null
  species: { id: string; name: string } | null
  plantingYear: number | null
  rowSpacingM: number | null
  treeSpacingM: number | null
  irrigation: Irrigation | null
  pricePerKg: number | null
  estimate: Estimate | null
  createdAt: string
  updatedAt: string
}

export const IRRIGATION_LABEL: Record<Irrigation, string> = {
  'goutte-a-goutte': 'Goutte-à-goutte',
  aspersion: 'Aspersion',
  gravitaire: 'Gravitaire',
  pluvial: 'Sans irrigation',
}

export const STAGE_LABEL: Record<Stage, string> = {
  futur: 'À planter',
  jeune: 'Jeune',
  adulte: 'Adulte',
  mature: 'En pleine production',
  declin: 'Vieillissant',
}
