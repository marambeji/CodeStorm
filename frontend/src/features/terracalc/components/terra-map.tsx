import 'leaflet/dist/leaflet.css'
import '../terracalc.css'
import L from 'leaflet'
import { useEffect, useMemo, useRef, type Ref } from 'react'
import { MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { cn } from '@/lib/utils'
import { DEFAULT_VIEW, ESRI_SATELLITE, OSM_PLAN, sentinelLayer, type BaseLayer } from '../layers'
import type { LatLng } from '../types'
import type { DrawMode } from '../use-drawing'

const LEAF = '#10B981'

export interface LayerState {
  base: BaseLayer
  year: number
  compare: boolean
  compareYears: [number, number]
  /** Position du séparateur de comparaison, de 0 (gauche) à 1 (droite) */
  divider: number
}

export interface FlyTarget {
  key: number
  center?: LatLng
  zoom?: number
  bounds?: [LatLng, LatLng]
}

interface TerraMapProps {
  /** Accès à l'objet carte Leaflet (zoom depuis les boutons personnalisés) */
  mapRef?: Ref<L.Map>
  points: LatLng[]
  mode: DrawMode
  selected: number | null
  trees: LatLng[]
  layers: LayerState
  flyTo: FlyTarget | null
  userPosition: LatLng | null
  /** Désactive le dessin (étapes 2 et 3 : on regarde le résultat) */
  locked: boolean
  initialBounds?: [LatLng, LatLng]
  onAdd: (p: LatLng) => void
  onMoveStart: () => void
  onMove: (i: number, p: LatLng) => void
  onInsert: (i: number, p: LatLng) => void
  onSelect: (i: number | null) => void
  onClose: () => void
}

/** Carte Leaflet de TerraCalc : fonds de carte, dessin du terrain, arbres, comparaison. */
export function TerraMap(props: TerraMapProps) {
  const { initialBounds, mode, locked, mapRef } = props
  return (
    <MapContainer
      ref={mapRef}
      className={cn('terra-map size-full', mode === 'draw' && !locked && 'is-drawing')}
      {...(initialBounds ? { bounds: initialBounds, boundsOptions: { padding: [60, 60] } } : { center: DEFAULT_VIEW.center, zoom: DEFAULT_VIEW.zoom })}
      zoomControl={false}
      attributionControl
      maxZoom={20}
      minZoom={3}
      worldCopyJump
    >
      <BaseLayers layers={props.layers} />
      <TreesLayer points={props.trees} />
      <DrawingLayer {...props} />
      <MapClicks {...props} />
      <FlyController target={props.flyTo} />
      <UserPosition position={props.userPosition} />
    </MapContainer>
  )
}

// ─────────────────────────── Fonds de carte ───────────────────────────

function BaseLayers({ layers }: { layers: LayerState }) {
  if (layers.base === 'plan') return <TileLayer key="plan" {...OSM_PLAN} maxZoom={20} />
  if (layers.base === 'historique') {
    if (layers.compare) return <CompareLayers years={layers.compareYears} divider={layers.divider} />
    const s2 = sentinelLayer(layers.year)
    return <TileLayer key={`s2-${layers.year}`} {...s2} maxZoom={20} />
  }
  return <TileLayer key="esri" {...ESRI_SATELLITE} maxZoom={20} />
}

/**
 * Comparaison avant / après : deux couches superposées, celle de droite est "découpée"
 * à la position du séparateur. Le découpage est recalculé à chaque déplacement de la carte
 * (même principe que le plugin leaflet-side-by-side).
 */
function CompareLayers({ years, divider }: { years: [number, number]; divider: number }) {
  const map = useMap()
  const right = useRef<L.TileLayer | null>(null)

  useEffect(() => {
    const [a, b] = years
    const left = L.tileLayer(sentinelLayer(a).url, { ...sentinelLayer(a), maxZoom: 20 }).addTo(map)
    right.current = L.tileLayer(sentinelLayer(b).url, { ...sentinelLayer(b), maxZoom: 20 }).addTo(map)
    return () => {
      left.remove()
      right.current?.remove()
      right.current = null
    }
  }, [map, years])

  useEffect(() => {
    const update = () => {
      const container = right.current?.getContainer()
      if (!container) return
      const nw = map.containerPointToLayerPoint([0, 0])
      const se = map.containerPointToLayerPoint(map.getSize())
      const clipX = nw.x + map.getSize().x * divider
      container.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${clipX}px)`
    }
    update()
    map.on('move zoom resize', update)
    return () => {
      map.off('move zoom resize', update)
    }
  }, [map, divider, years])

  return null
}

// ─────────────────────────── Arbres (aperçu) ───────────────────────────

/**
 * Jusqu'à 5 000 arbres : on les dessine en Canvas, directement avec Leaflet
 * (5 000 composants React seraient bien trop lents).
 */
function TreesLayer({ points }: { points: LatLng[] }) {
  const map = useMap()
  const renderer = useMemo(() => L.canvas({ padding: 0.3 }), [])

  useEffect(() => {
    if (!points.length) return
    // Plus on dézoome, plus les points sont petits (sinon ils forment un tapis uniforme)
    const radiusFor = (z: number) => (z >= 19 ? 4.5 : z >= 18 ? 3.5 : z >= 17 ? 2.5 : z >= 16 ? 1.8 : 1.2)
    const markers = points.map((p) =>
      L.circleMarker(p, {
        renderer,
        radius: radiusFor(map.getZoom()),
        color: '#ffffff',
        weight: 1,
        fillColor: LEAF,
        fillOpacity: 0.95,
        interactive: false,
      }),
    )
    const group = L.layerGroup(markers).addTo(map)
    const onZoom = () => {
      const r = radiusFor(map.getZoom())
      markers.forEach((m) => m.setRadius(r))
    }
    map.on('zoomend', onZoom)
    return () => {
      map.off('zoomend', onZoom)
      group.remove()
    }
  }, [map, points, renderer])

  return null
}

// ─────────────────────────── Dessin du polygone ───────────────────────────

/**
 * Icônes des sommets, mises en cache : si on recréait l'icône à chaque rendu, Leaflet
 * remplacerait l'élément HTML en plein glissement… et le glissement s'arrêterait.
 */
const iconCache = new Map<string, L.DivIcon>()
function vertexIcon(selected: boolean, first: boolean, closable: boolean) {
  const key = `${selected}-${first && closable}`
  let icon = iconCache.get(key)
  if (!icon) {
    icon = L.divIcon({
      className: 'tc-vertex',
      html: `<span class="tc-vertex-dot${selected ? ' is-selected' : ''}${first && closable ? ' is-closable' : ''}"></span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    })
    iconCache.set(key, icon)
  }
  return icon
}

const midpointIcon = L.divIcon({ className: 'tc-vertex', html: '<span class="tc-midpoint"></span>', iconSize: [28, 28], iconAnchor: [14, 14] })

function DrawingLayer({ points, mode, selected, locked, onMoveStart, onMove, onInsert, onSelect, onClose }: TerraMapProps) {
  const closed = mode === 'edit' && points.length >= 3
  const editable = !locked
  const closable = mode === 'draw' && points.length >= 3

  // Points "fantômes" au milieu de chaque côté : un clic en insère un nouveau
  const midpoints = useMemo(() => {
    if (!closed || !editable) return []
    return points.map((p, i) => {
      const q = points[(i + 1) % points.length]
      return { index: i + 1, point: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2] as LatLng }
    })
  }, [points, closed, editable])

  return (
    <>
      {closed || (locked && points.length >= 3) ? (
        <Polygon positions={points} pathOptions={{ color: LEAF, weight: 2.5, fillColor: LEAF, fillOpacity: locked ? 0.08 : 0.16 }} />
      ) : (
        points.length >= 2 && (
          <>
            <Polyline positions={points} pathOptions={{ color: LEAF, weight: 2.5 }} />
            {points.length >= 3 && <Polyline positions={[points[points.length - 1], points[0]]} pathOptions={{ color: LEAF, weight: 2, dashArray: '6 6', opacity: 0.8 }} />}
          </>
        )
      )}

      {editable &&
        points.map((p, i) => (
          <Marker
            key={`v-${i}`}
            position={p}
            icon={vertexIcon(selected === i, i === 0, closable)}
            draggable
            keyboard={false}
            eventHandlers={{
              click: () => (closable && i === 0 ? onClose() : onSelect(selected === i ? null : i)),
              dragstart: () => onMoveStart(),
              drag: (e) => {
                const ll = (e.target as L.Marker).getLatLng()
                onMove(i, [ll.lat, ll.lng])
              },
            }}
          />
        ))}

      {midpoints.map((m) => (
        <Marker key={`m-${m.index}`} position={m.point} icon={midpointIcon} keyboard={false} eventHandlers={{ click: () => onInsert(m.index, m.point) }} />
      ))}
    </>
  )
}

function MapClicks({ mode, locked, onAdd, onSelect }: TerraMapProps) {
  useMapEvents({
    click: (e) => {
      if (locked) return
      if (mode === 'draw') onAdd([e.latlng.lat, e.latlng.lng])
      else onSelect(null)
    },
  })
  return null
}

function FlyController({ target }: { target: FlyTarget | null }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    if (target.bounds) map.flyToBounds(target.bounds, { padding: [60, 60], duration: 1.2, maxZoom: 18 })
    else if (target.center) map.flyTo(target.center, target.zoom ?? 17, { duration: 1.2 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key])
  return null
}

const userIcon = L.divIcon({ className: 'tc-vertex', html: '<span class="tc-user"></span>', iconSize: [24, 24], iconAnchor: [12, 12] })

function UserPosition({ position }: { position: LatLng | null }) {
  if (!position) return null
  return <Marker position={position} icon={userIcon} interactive={false} />
}
