import { Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { reversePlace, searchPlaces, type Place } from './api'

export interface PickedPlace {
  name: string
  lat: number
  lng: number
}

/**
 * Champ « lieu » : on tape une ville ou un village (ex. « Ariana »), les suggestions
 * apparaissent pendant la saisie ; ou on utilise la position GPS du téléphone.
 */
export function LocationField({ id, value, onChange, className }: { id?: string; value: PickedPlace | null; onChange: (p: PickedPlace | null) => void; className?: string }) {
  const { i18n } = useTranslation()
  const autoId = useId()
  const inputId = id ?? autoId
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [locating, setLocating] = useState(false)
  const seq = useRef(0)

  // Recherche pendant la saisie (300 ms après la dernière touche)
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const n = ++seq.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const r = await searchPlaces(query, i18n.language)
        if (n === seq.current) {
          setResults(r)
          setActive(0)
        }
      } catch {
        if (n === seq.current) setResults([])
      } finally {
        if (n === seq.current) setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query, i18n.language])

  // Lieu sans vrai nom (« Ma position actuelle », ancien choix GPS) : on retrouve le nom automatiquement
  const [naming, setNaming] = useState(false)
  useEffect(() => {
    if (!value || !/^(Ma position|Mon exploitation$)/.test(value.name)) return
    let cancelled = false
    setNaming(true)
    reversePlace(value.lat, value.lng, i18n.language)
      .then((name) => {
        if (!cancelled && name) onChange({ ...value, name })
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setNaming(false))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng, value?.name])

  function pick(p: Place) {
    onChange({ name: p.detail ? `${p.name} (${p.detail.split(',')[0]})` : p.name, lat: Math.round(p.lat * 1e4) / 1e4, lng: Math.round(p.lng * 1e4) / 1e4 })
    setQuery('')
    setResults([])
  }

  function locate() {
    if (!navigator.geolocation) return toast.error('La géolocalisation n’est pas disponible : tapez le nom de votre ville.')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e4) / 1e4
        const lng = Math.round(pos.coords.longitude * 1e4) / 1e4
        // Le GPS ne donne que des coordonnées : on retrouve le nom du lieu (ex. « Raoued, Ariana »)
        const name = await reversePlace(lat, lng, i18n.language).catch(() => null)
        setLocating(false)
        onChange({ name: name ?? 'Ma position actuelle', lat, lng })
        if (name) toast.success(`Position détectée : ${name}`)
      },
      () => {
        setLocating(false)
        toast.error('Position refusée ou indisponible : tapez le nom de votre ville.')
      },
      { timeout: 10_000 },
    )
  }

  const open = query.trim().length >= 2

  return (
    <div className={cn('space-y-2', className)}>
      {value && (
        <p className="flex items-center gap-2 rounded-xl bg-leaf/10 px-3 py-2 text-sm">
          <MapPin className="size-4 shrink-0 text-leaf-fg" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">{naming ? 'Recherche du nom du lieu…' : value.name}</span>
          <span className="tabular hidden text-xs text-muted-foreground sm:inline">
            {value.lat.toFixed(3)}, {value.lng.toFixed(3)}
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-foreground" aria-label="Changer de lieu">
            <X className="size-4" aria-hidden="true" />
          </button>
        </p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (!results.length) return
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(a + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(a - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              pick(results[active])
            } else if (e.key === 'Escape') setQuery('')
          }}
          placeholder={value ? 'Changer de lieu : tapez une ville…' : 'Tapez une ville ou un village, ex. Ariana'}
          className="ps-9"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={`${inputId}-list`}
        />
        {loading && <Loader2 className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden="true" />}
        {open && !loading && (
          <ul id={`${inputId}-list`} role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Aucun lieu trouvé : essayez la ville la plus proche.</li>
            ) : (
              results.map((r, i) => (
                <li key={`${r.lat},${r.lng}`} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(r)}
                    className={cn('flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm', i === active && 'bg-muted')}
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.detail}</span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={locate} disabled={locating}>
        {locating ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LocateFixed aria-hidden="true" />} {locating ? 'Détection de votre position…' : 'Utiliser ma position GPS'}
      </Button>
    </div>
  )
}
