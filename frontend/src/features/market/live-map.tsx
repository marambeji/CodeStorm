import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { Crosshair, Loader2, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Point } from './routing'

const OSM = {
  url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}
/** Vue par défaut : Tunisie */
const DEFAULT_CENTER: [number, number] = [34.74, 10.76]

// Marqueurs en HTML (pas d'images à charger) : ferme verte, maison bleue, livreur ambre animé
const pin = (bg: string, svg: string, extra = '') =>
  L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div class="relative flex size-9 items-center justify-center rounded-full border-2 border-white text-white shadow-lg ${extra}" style="background:${bg}">${svg}</div>`,
  })
const SVG = {
  farm: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>',
  home: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  truck: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
}
const ICONS = {
  farm: pin('#10B981', SVG.farm),
  home: pin('#0EA5E9', SVG.home),
  courier: pin('#F59E0B', SVG.truck, 'courier-pulse'),
}
const numbered = (n: number, kind: 'ferme' | 'client') =>
  L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div class="flex size-[30px] items-center justify-center rounded-full border-2 border-white text-xs font-bold text-white shadow-md" style="background:${kind === 'ferme' ? '#10B981' : '#0EA5E9'}">${n}</div>`,
  })

export interface MapStop extends Point {
  kind: 'ferme' | 'client'
  label: string
  /** Numéro dans la tournée (sinon icône ferme / maison) */
  n?: number
}

/** Carte de livraison : arrêts, livreur en direct et tracé de la route */
export function DeliveryMap({ stops, courier, path, className }: { stops: MapStop[]; courier?: Point | null; path?: [number, number][]; className?: string }) {
  const points = useMemo(() => [...stops, ...(courier ? [courier] : [])], [stops, courier])
  return (
    <div className={cn('relative isolate overflow-hidden rounded-xl border', className)}>
      <style>{`@keyframes courier-pulse{0%{box-shadow:0 0 0 0 rgba(245,158,11,.55)}100%{box-shadow:0 0 0 16px rgba(245,158,11,0)}}.courier-pulse{animation:courier-pulse 1.6s ease-out infinite}`}</style>
      <MapContainer center={points[0] ? [points[0].lat, points[0].lng] : DEFAULT_CENTER} zoom={13} className="size-full" scrollWheelZoom={false} attributionControl>
        <TileLayer url={OSM.url} attribution={OSM.attribution} maxZoom={19} />
        {path && path.length > 1 && (
          <>
            <Polyline positions={path} pathOptions={{ color: '#ffffff', weight: 8, opacity: 0.9 }} />
            <Polyline positions={path} pathOptions={{ color: '#0EA5E9', weight: 5 }} />
          </>
        )}
        {stops.map((s, i) => (
          <Marker key={`${s.kind}-${i}-${s.lat}`} position={[s.lat, s.lng]} icon={s.n ? numbered(s.n, s.kind) : s.kind === 'ferme' ? ICONS.farm : ICONS.home}>
            <Tooltip direction="top" offset={[0, -16]}>
              {s.label}
            </Tooltip>
          </Marker>
        ))}
        {courier && (
          <Marker position={[courier.lat, courier.lng]} icon={ICONS.courier} zIndexOffset={1000}>
            <Tooltip direction="top" offset={[0, -16]}>
              Livreur
            </Tooltip>
          </Marker>
        )}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  )
}

/** Cadre la carte sur tous les points ; ne recadre plus après une action de l'utilisateur */
function FitBounds({ points }: { points: Point[] }) {
  const map = useMap()
  const touched = useRef(false)
  const key = points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|')
  useMapEvents({ dragstart: () => (touched.current = true), zoomstart: (e) => ((e as unknown as { originalEvent?: Event }).originalEvent ? (touched.current = true) : null) })
  useEffect(() => {
    if (touched.current || !points.length) return
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 15)
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [36, 36], maxZoom: 16 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map])
  return null
}

// ─────────────────────────────── Choix du point de livraison ───────────────────────────────

/**
 * Le client place son point de livraison : sa position GPS, une adresse recherchée,
 * ou un clic / glisser sur la carte. C'est ce point que suit le livreur.
 */
export function LocationPicker({ value, onChange, onAddress }: { value: Point | null; onChange: (p: Point) => void; onAddress?: (label: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([])
  const [busy, setBusy] = useState<'gps' | 'search' | null>(null)
  const [fly, setFly] = useState<{ p: Point; k: number } | null>(null)

  const set = (p: Point, label?: string) => {
    onChange(p)
    setFly({ p, k: Date.now() })
    if (label) onAddress?.(label)
  }

  function locate() {
    if (!navigator.geolocation) return toast.error('La géolocalisation n’est pas disponible sur cet appareil.')
    setBusy('gps')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        set(p)
        setBusy(null)
        const label = await reverse(p)
        if (label) onAddress?.(label)
      },
      () => {
        setBusy(null)
        toast.error('Position refusée : recherchez votre adresse ou touchez la carte.')
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    )
  }

  // Pas de <form> ici : le sélecteur est placé dans le formulaire de commande
  async function search() {
    if (query.trim().length < 3) return
    setBusy('search')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query.trim())}&format=jsonv2&limit=5&accept-language=fr`, { signal: AbortSignal.timeout(8000) })
      const d = (await res.json()) as { display_name: string; lat: string; lon: string }[]
      setResults(d.map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) })))
      if (!d.length) toast.info('Adresse introuvable : essayez avec le nom de la ville, ou touchez la carte.')
    } catch {
      toast.error('Recherche indisponible : touchez la carte pour placer le point.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void search()
              }
            }}
            enterKeyHint="search"
            placeholder="Chercher une adresse puis Entrée…"
            className="ps-9"
            aria-label="Chercher une adresse"
          />
          {busy === 'search' && <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
        </div>
        <Button type="button" variant="outline" onClick={locate} disabled={busy !== null}>
          {busy === 'gps' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Crosshair aria-hidden="true" />}
          <span className="hidden sm:inline">Ma position</span>
        </Button>
      </div>
      {results.length > 0 && (
        <ul className="max-h-36 overflow-y-auto rounded-lg border bg-popover text-sm" role="listbox" aria-label="Adresses trouvées">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                type="button"
                className="w-full px-3 py-2 text-start hover:bg-muted"
                onClick={() => {
                  set({ lat: r.lat, lng: r.lng }, r.label.split(',').slice(0, 3).join(','))
                  setResults([])
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative isolate h-52 overflow-hidden rounded-xl border">
        <MapContainer center={value ? [value.lat, value.lng] : DEFAULT_CENTER} zoom={value ? 16 : 6} className="size-full" attributionControl>
          <TileLayer url={OSM.url} attribution={OSM.attribution} maxZoom={19} />
          <PickHandler onPick={(p) => onChange(p)} fly={fly} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={ICONS.home}
              draggable
              eventHandlers={{ dragend: (e) => onChange({ lat: (e.target as L.Marker).getLatLng().lat, lng: (e.target as L.Marker).getLatLng().lng }) }}
            />
          )}
        </MapContainer>
        {!value && <p className="pointer-events-none absolute inset-x-0 bottom-2 z-[400] mx-auto w-fit rounded-full bg-background/90 px-3 py-1 text-xs shadow">Touchez la carte pour placer votre point de livraison</p>}
      </div>
    </div>
  )
}

function PickHandler({ onPick, fly }: { onPick: (p: Point) => void; fly: { p: Point; k: number } | null }) {
  const map = useMap()
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  useEffect(() => {
    if (fly) map.flyTo([fly.p.lat, fly.p.lng], 17, { duration: 0.8 })
  }, [fly, map])
  return null
}

async function reverse(p: Point): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${p.lat}&lon=${p.lng}&format=jsonv2&zoom=18&accept-language=fr`, { signal: AbortSignal.timeout(6000) })
    const d = (await res.json()) as { address?: Record<string, string> }
    const a = d.address ?? {}
    const street = [a.house_number, a.road].filter(Boolean).join(' ')
    return [street, a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(', ') || null
  } catch {
    return null
  }
}
