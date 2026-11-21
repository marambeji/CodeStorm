import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { LatLng } from '../types'

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string] // [sud, nord, ouest, est]
}

/**
 * Recherche d'adresse (Nominatim / OpenStreetMap) + bouton "Ma position".
 * Règle d'usage de Nominatim : pas d'autocomplétion à chaque touche, on cherche
 * seulement quand l'utilisateur valide (Entrée ou bouton).
 */
export function LocationSearch({
  onPlace,
  onLocate,
  className,
}: {
  onPlace: (bounds: [LatLng, LatLng]) => void
  onLocate: (p: LatLng) => void
  className?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  async function search(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q.length < 2) return
    setLoading(true)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=fr&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as NominatimResult[]
      setResults(data)
      if (!data.length) toast.info(`Aucun lieu trouvé pour « ${q} ». Essayez avec le nom de la ville.`)
    } catch {
      toast.error('La recherche est indisponible (pas de connexion ?). Déplacez la carte à la main.')
    } finally {
      setLoading(false)
    }
  }

  function pick(r: NominatimResult) {
    const [s, n, w, e] = r.boundingbox.map(Number)
    onPlace([
      [s, w],
      [n, e],
    ])
    setResults(null)
    setQuery(r.display_name.split(',')[0])
  }

  function locate() {
    if (!('geolocation' in navigator)) {
      toast.error("Votre navigateur ne permet pas la géolocalisation.")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        onLocate([pos.coords.latitude, pos.coords.longitude])
      },
      (err) => {
        setLocating(false)
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? 'Accès à la position refusé. Autorisez-le dans les réglages du navigateur, ou recherchez une adresse.'
            : 'Position introuvable pour le moment. Recherchez plutôt une adresse.',
        )
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-2">
        <form onSubmit={search} role="search" className="glass flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border pr-1 pl-3 shadow-[var(--shadow-float)]">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="tc-search" className="sr-only">
            Rechercher une adresse ou une ville
          </label>
          <input
            id="tc-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Adresse, ville, lieu-dit…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => (setQuery(''), setResults(null))} className="rounded-md p-1 text-muted-foreground hover:text-foreground" aria-label="Effacer la recherche">
              <X className="size-4" />
            </button>
          )}
          <Button type="submit" size="icon-sm" variant="ghost" disabled={loading} aria-label="Lancer la recherche">
            {loading ? <Loader2 className="animate-spin" /> : <Search />}
          </Button>
        </form>
        <Button
          variant="outline"
          size="icon"
          onClick={locate}
          disabled={locating}
          className="glass size-11 shrink-0 rounded-xl shadow-[var(--shadow-float)]"
          aria-label="Centrer la carte sur ma position"
          title="Ma position"
        >
          {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />}
        </Button>
      </div>

      <AnimatePresence>
        {results && results.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-xl border bg-popover p-1 shadow-[var(--shadow-float)]"
          >
            {results.map((r) => (
              <li key={r.place_id}>
                <button onClick={() => pick(r)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-leaf-fg" aria-hidden="true" />
                  <span className="line-clamp-2">{r.display_name}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
