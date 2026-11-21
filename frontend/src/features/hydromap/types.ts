import type { FeatureCollection, Polygon } from 'geojson'

export type StressLevel = 'faible' | 'modéré' | 'élevé' | 'critique'
export type Indicator = 'stress' | 'ndvi' | 'ndwi'
export type ObservationType = 'puits' | 'irrigation' | 'secheresse' | 'autre'

export interface ZoneProps {
  id: string
  name: string
  landUse: string
  areaHa: number
  ndvi: number
  ndwi: number
  rainfallAnomaly: number
  groundwaterTrend: number
  stress: number
  level: StressLevel
}

export type Zones = FeatureCollection<Polygon, ZoneProps> & { source: string }

export interface Overview {
  counts: Record<StressLevel, number>
  worst: { id: string; name: string; stress: number; level: StressLevel }[]
  averageStress: number
  totalAreaHa: number
  ai: { summary: string }
}

export interface Forecast {
  zoneId: string
  history: { date: string; stress: number }[]
  forecast: { date: string; stress: number; low: number; high: number }[]
  trend: 'hausse' | 'baisse' | 'stable'
  slopePerMonth: number
  level: StressLevel
}

export interface Observation {
  id: string
  zoneId: string
  type: ObservationType
  note: string
  waterLevelM: number | null
  observedAt: string
}

/** Couleurs du stress hydrique, du vert au rouge (toujours accompagnées du libellé) */
export const LEVEL_STYLE: Record<StressLevel, { color: string; label: string }> = {
  faible: { color: '#10B981', label: 'Faible' },
  modéré: { color: '#EAB308', label: 'Modéré' },
  élevé: { color: '#F97316', label: 'Élevé' },
  critique: { color: '#EF4444', label: 'Critique' },
}

/** Échelles séquentielles (une teinte qui s'intensifie) pour les indices satellitaires */
export const SCALES: Record<Exclude<Indicator, 'stress'>, { stops: number[]; colors: string[]; labels: string[]; title: string }> = {
  ndvi: {
    title: 'NDVI : vigueur de la végétation',
    stops: [0.2, 0.35, 0.5, 0.65],
    colors: ['#A16207', '#CA8A04', '#84CC16', '#22C55E', '#15803D'],
    labels: ['< 0,2', '0,2 – 0,35', '0,35 – 0,5', '0,5 – 0,65', '> 0,65'],
  },
  ndwi: {
    title: 'NDWI : eau dans la végétation et le sol',
    stops: [-0.2, -0.05, 0.1, 0.25],
    colors: ['#D6B98C', '#BAE6FD', '#38BDF8', '#0284C7', '#075985'],
    labels: ['< -0,2', '-0,2 – -0,05', '-0,05 – 0,1', '0,1 – 0,25', '> 0,25'],
  },
}

export function zoneColor(z: ZoneProps, indicator: Indicator) {
  if (indicator === 'stress') return LEVEL_STYLE[z.level].color
  const s = SCALES[indicator]
  const value = z[indicator]
  const i = s.stops.findIndex((stop) => value < stop)
  return s.colors[i === -1 ? s.colors.length - 1 : i]
}

export const OBSERVATION_LABEL: Record<ObservationType, string> = {
  puits: 'Niveau de puits',
  irrigation: 'Irrigation',
  secheresse: 'Sécheresse',
  autre: 'Autre',
}
