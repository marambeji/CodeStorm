import 'leaflet/dist/leaflet.css'
import '../terracalc/terracalc.css'
import L from 'leaflet'
import { useEffect, useMemo, type Ref } from 'react'
import { GeoJSON, MapContainer, TileLayer, useMap } from 'react-leaflet'
import { ESRI_SATELLITE } from '../terracalc/layers'
import { zoneColor, type Indicator, type Zones } from './types'

/**
 * Carte HydroMap : zones colorées selon l'indicateur choisi (choroplèthe).
 * Survol : contour mis en avant + nom ; clic : sélection de la zone.
 */
export function HydroMap({
  zones,
  indicator,
  selectedId,
  onSelect,
  mapRef,
}: {
  zones: Zones
  indicator: Indicator
  selectedId: string | null
  onSelect: (id: string | null) => void
  mapRef?: Ref<L.Map>
}) {
  const bounds = useMemo(() => L.geoJSON(zones).getBounds().pad(0.08), [zones])

  return (
    <MapContainer ref={mapRef} bounds={bounds} className="terra-map size-full" zoomControl={false} minZoom={7} maxZoom={17}>
      <TileLayer {...ESRI_SATELLITE} maxZoom={17} />
      {/* Assombrit légèrement l'image pour faire ressortir les couleurs des zones */}
      <div className="pointer-events-none absolute inset-0 z-[300] bg-black/25" aria-hidden="true" />
      <ZonesLayer zones={zones} indicator={indicator} selectedId={selectedId} onSelect={onSelect} />
      <FitSelected zones={zones} selectedId={selectedId} />
    </MapContainer>
  )
}

function ZonesLayer({ zones, indicator, selectedId, onSelect }: { zones: Zones; indicator: Indicator; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <GeoJSON
      // La clé force le redessin quand l'indicateur ou la sélection changent
      key={`${indicator}-${selectedId}`}
      data={zones}
      style={(f) => {
        const p = f!.properties as Zones['features'][number]['properties']
        const selected = p.id === selectedId
        return {
          color: selected ? '#ffffff' : 'rgba(255,255,255,0.65)',
          weight: selected ? 3.5 : 1.2,
          fillColor: zoneColor(p, indicator),
          fillOpacity: selectedId && !selected ? 0.35 : 0.62,
        }
      }}
      onEachFeature={(f, layer) => {
        const p = f.properties as Zones['features'][number]['properties']
        layer.bindTooltip(`<strong>${p.name}</strong><br/>Stress ${Math.round(p.stress * 100)} %`, { sticky: true, direction: 'top', className: 'hydro-tooltip' })
        layer.on({
          click: (e) => {
            L.DomEvent.stopPropagation(e)
            onSelect(p.id)
          },
          mouseover: (e) => (e.target as L.Path).setStyle({ weight: 3, color: '#ffffff' }),
          mouseout: (e) => (e.target as L.Path).setStyle({ weight: p.id === selectedId ? 3.5 : 1.2, color: p.id === selectedId ? '#ffffff' : 'rgba(255,255,255,0.65)' }),
        })
      }}
    />
  )
}

/** Centre la carte sur la zone sélectionnée (en laissant la place au panneau) */
function FitSelected({ zones, selectedId }: { zones: Zones; selectedId: string | null }) {
  const map = useMap()
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)').matches
    const target = selectedId ? zones.features.find((f) => f.properties.id === selectedId) : null
    const bounds = target ? L.geoJSON(target).getBounds() : L.geoJSON(zones).getBounds()
    map.flyToBounds(bounds, {
      paddingTopLeft: [40, desktop ? 90 : 150],
      paddingBottomRight: desktop ? [selectedId ? 600 : 440, 40] : [40, 240],
      duration: 0.9,
      maxZoom: selectedId ? 12 : 11,
    })
  }, [map, zones, selectedId])
  return null
}
