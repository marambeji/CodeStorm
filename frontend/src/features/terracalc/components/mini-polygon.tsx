import type { Polygon } from 'geojson'
import { useId, useMemo } from 'react'

/**
 * Mini-carte vectorielle d'un terrain (pour les cartes de la liste).
 * Le contour garde ses vraies proportions ; un motif de points évoque la plantation.
 */
export function MiniPolygon({ polygon, trees, className }: { polygon: Polygon; trees: boolean; className?: string }) {
  const id = useId().replace(/:/g, '')
  const path = useMemo(() => {
    const ring = polygon.coordinates[0]
    const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const k = Math.cos((lat0 * Math.PI) / 180)
    const pts = ring.map(([lng, lat]) => [lng * k, lat])
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
    const W = 200
    const H = 120
    const pad = 16
    const scale = Math.min((W - 2 * pad) / (maxX - minX || 1), (H - 2 * pad) / (maxY - minY || 1))
    const ox = (W - (maxX - minX) * scale) / 2
    const oy = (H - (maxY - minY) * scale) / 2
    return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + (x - minX) * scale).toFixed(1)},${(oy + (maxY - y) * scale).toFixed(1)}`).join(' ') + ' Z'
  }, [polygon])

  return (
    <svg viewBox="0 0 200 120" className={className} role="img" aria-label="Contour du terrain">
      <defs>
        <pattern id={`dots-${id}`} width="7" height="7" patternUnits="userSpaceOnUse">
          <circle cx="3.5" cy="3.5" r="1.4" fill="#10B981" />
        </pattern>
        <pattern id={`grid-${id}`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" className="stroke-foreground/[0.06]" />
        </pattern>
      </defs>
      <rect width="200" height="120" fill={`url(#grid-${id})`} />
      <path d={path} fill="#10B981" fillOpacity="0.14" />
      {trees && <path d={path} fill={`url(#dots-${id})`} opacity="0.7" />}
      <path d={path} fill="none" stroke="#10B981" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
