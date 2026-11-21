import turfBbox from '@turf/bbox'
import { feature } from '@turf/helpers'
import type { Polygon } from 'geojson'

const SIZE = 768

/**
 * Image satellite (Esri World Imagery) centrée sur le terrain, avec une marge autour,
 * et la position des sommets du terrain en pixels (pour que l'IA sache quelle zone regarder).
 */
export async function satelliteSnapshot(polygon: Polygon): Promise<{ image: Buffer; pixels: [number, number][] } | null> {
  const [minX, minY, maxX, maxY] = turfBbox(feature(polygon))
  const midLat = (minY + maxY) / 2
  // Boîte carrée en mètres (la longitude est "plus courte" quand on s'éloigne de l'équateur)
  const k = Math.cos((midLat * Math.PI) / 180)
  const half = (Math.max((maxX - minX) * k, maxY - minY) / 2) * 1.35
  const cx = (minX + maxX) / 2
  const cy = midLat
  const box = [cx - half / k, cy - half, cx + half / k, cy + half]
  const url =
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export' +
    `?bbox=${box.join(',')}&bboxSR=4326&imageSR=4326&size=${SIZE},${SIZE}&format=jpg&f=image`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null
    const image = Buffer.from(await res.arrayBuffer())
    const ring = polygon.coordinates[0].slice(0, -1)
    const pixels = ring.map(([lng, lat]) => [Math.round(((lng - box[0]) / (box[2] - box[0])) * SIZE), Math.round(((box[3] - lat) / (box[3] - box[1])) * SIZE)] as [number, number])
    return { image, pixels }
  } catch {
    return null
  }
}
