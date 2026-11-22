import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useMe, type User } from '@/features/auth/auth'
import { api } from '@/lib/api'

/** Profil = l'agriculteur connecté (nom, exploitation, lieu) */
export function useProfile() {
  return useMe()
}

export function useSaveProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (p: { name: string; farmName?: string; phone?: string; placeName?: string; lat?: number | null; lng?: number | null }) => (await api.put<User>('/auth/me', p)).data,
    onSuccess: (user) => {
      qc.setQueryData(['me'], user)
      qc.invalidateQueries({ queryKey: ['weather-place'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export interface Place {
  name: string
  detail: string
  lat: number
  lng: number
}

/** Recherche d'une ville ou d'un village (Open-Meteo Geocoding, gratuit, sans clé) */
export async function searchPlaces(query: string, lang = 'fr'): Promise<Place[]> {
  if (query.trim().length < 2) return []
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=${lang}&format=json`)
  if (!res.ok) return []
  const d = (await res.json()) as { results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }
  return (d.results ?? []).map((r) => ({ name: r.name, detail: [r.admin1, r.country].filter(Boolean).join(', '), lat: r.latitude, lng: r.longitude }))
}

/** Initiales pour l'avatar : « Salim Ben Ali » → « SB » */
export function initials(name: string | null | undefined) {
  if (!name) return 'EN'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')).toUpperCase()
}

/**
 * Nom du lieu à partir de coordonnées GPS (géocodage inverse), ex. « Raoued, Ariana ».
 * BigDataCloud (gratuit, sans clé, prévu pour le navigateur), puis OpenStreetMap Nominatim en secours.
 */
export async function reversePlace(lat: number, lng: number, lang = 'fr'): Promise<string | null> {
  const join = (...parts: (string | undefined | null)[]) => [...new Set(parts.filter((p): p is string => Boolean(p && p.trim())))].join(', ') || null
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${lang}`, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const d = (await res.json()) as { locality?: string; city?: string; principalSubdivision?: string }
      const name = join(d.locality || d.city, d.principalSubdivision?.replace(/^Gouvernorat (de |d’|d')?/i, ''))
      if (name) return name
    }
  } catch {
    /* service suivant */
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=12&accept-language=${lang}`, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const d = (await res.json()) as { address?: Record<string, string> }
      const a = d.address ?? {}
      return join(a.city || a.town || a.village || a.municipality || a.county, a.state?.replace(/^Gouvernorat (de |d’|d')?/i, ''))
    }
  } catch {
    /* pas de nom : on garde « Ma position » */
  }
  return null
}
