import turfArea from '@turf/area'
import turfCentroid from '@turf/centroid'
import { feature } from '@turf/helpers'
import turfKinks from '@turf/kinks'
import turfLength from '@turf/length'
import type { Polygon } from 'geojson'
import type { LatLng } from './types'

/**
 * Mesures en direct pendant le dessin (Turf.js, dans le navigateur).
 * Le backend refait les mêmes calculs à l'enregistrement : on ne fait jamais confiance au client.
 */

/** Points Leaflet [lat, lng] → polygone GeoJSON [lng, lat] fermé */
export function toPolygon(points: LatLng[]): Polygon | null {
  if (points.length < 3) return null
  const ring = points.map(([lat, lng]) => [lng, lat])
  return { type: 'Polygon', coordinates: [[...ring, ring[0]]] }
}

/** Polygone GeoJSON → points Leaflet (sans le point de fermeture) */
export function fromPolygon(polygon: Polygon): LatLng[] {
  return polygon.coordinates[0].slice(0, -1).map(([lng, lat]) => [lat, lng])
}

export interface Measures {
  areaM2: number
  perimeterM: number
  centroid: LatLng | null
  vertexCount: number
  selfIntersects: boolean
}

export function measure(points: LatLng[]): Measures {
  const polygon = toPolygon(points)
  if (!polygon) {
    // Moins de 3 points : pas encore de surface, mais on peut déjà mesurer la ligne
    const line = points.length >= 2 ? turfLength(feature({ type: 'LineString', coordinates: points.map(([a, b]) => [b, a]) }), { units: 'meters' }) : 0
    return { areaM2: 0, perimeterM: line, centroid: null, vertexCount: points.length, selfIntersects: false }
  }
  const [lng, lat] = turfCentroid(polygon).geometry.coordinates
  return {
    areaM2: turfArea(polygon),
    perimeterM: turfLength(feature(polygon), { units: 'meters' }),
    centroid: [lat, lng],
    vertexCount: points.length,
    selfIntersects: turfKinks(polygon).features.length > 0,
  }
}

/** Un terrain est exploitable s'il a 3 points, une vraie surface et un contour simple */
export function isValidShape(m: Measures) {
  return m.vertexCount >= 3 && m.areaM2 >= 50 && !m.selfIntersects
}

/**
 * En français, Intl sépare les milliers par une espace fine insécable (U+202F),
 * absente de notre police : on la remplace par une espace insécable classique (U+00A0).
 */
const nf = (d: number) => ({
  format: (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n).replace(/\u202f/g, '\u00a0'),
})
export const formatArea = (m2: number) => (m2 >= 10_000 ? `${nf(2).format(m2 / 10_000)} ha` : `${nf(0).format(m2)} m²`)
export const formatLength = (m: number) => (m >= 1000 ? `${nf(2).format(m / 1000)} km` : `${nf(0).format(m)} m`)
export const formatKg = (kg: number) => (kg >= 1000 ? `${nf(1).format(kg / 1000)}\u00a0t` : `${nf(0).format(kg)}\u00a0kg`)
export const formatEur = (n: number) => `${nf(0).format(n)}\u00a0€`
export const formatNumber = (n: number, d = 0) => nf(d).format(n)
