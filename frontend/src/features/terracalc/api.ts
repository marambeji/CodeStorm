import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Polygon } from 'geojson'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { CropConfig, Estimate, Species, Terrain } from './types'

/**
 * Accès aux données TerraCalc avec React Query :
 * cache, rechargement automatique après une modification, états de chargement.
 */
const keys = {
  species: ['species'] as const,
  terrains: ['terrains'] as const,
  terrain: (id: string) => ['terrains', id] as const,
}

export function useSpecies() {
  return useQuery({
    queryKey: keys.species,
    queryFn: async () => (await api.get<Species[]>('/species')).data,
    staleTime: Infinity, // données de référence : ne changent pas pendant la session
  })
}

export function useTerrains() {
  return useQuery({ queryKey: keys.terrains, queryFn: async () => (await api.get<Terrain[]>('/terrains')).data })
}

export function useTerrain(id: string | undefined) {
  return useQuery({
    queryKey: keys.terrain(id ?? ''),
    queryFn: async () => (await api.get<Terrain>(`/terrains/${id}`)).data,
    enabled: Boolean(id),
  })
}

/**
 * Estimation en direct : recalculée (avec un petit délai) dès que le polygone ou la culture change.
 * `placeholderData` garde l'ancien résultat affiché pendant le recalcul → aucun clignotement.
 */
export function useEstimate(polygon: Polygon | null, config: CropConfig | null) {
  const input = polygon && config?.speciesId ? { polygon, ...config } : null
  const debounced = useDebounced(input, 350)
  return useQuery({
    queryKey: ['estimate', debounced],
    queryFn: async () => (await api.post<Estimate>('/terrains/estimate', debounced)).data,
    enabled: Boolean(debounced),
    placeholderData: keepPreviousData,
    retry: false,
  })
}

type TerrainPayload = CropConfig & { name: string; polygon: Polygon }

export function useSaveTerrain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...payload }: TerrainPayload & { id?: string }) =>
      id ? (await api.patch<Terrain>(`/terrains/${id}`, payload)).data : (await api.post<Terrain>('/terrains', payload)).data,
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: keys.terrains })
      qc.setQueryData(keys.terrain(t.id), t)
    },
  })
}

export function useDeleteTerrain() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/terrains/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.terrains }),
  })
}

/** Message d'erreur lisible à partir d'une réponse NestJS (message = texte ou liste) */
export function apiErrorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
  if (Array.isArray(data?.message)) return data.message.join(' ')
  if (data?.message) return data.message
  return 'Le serveur ne répond pas. Vérifiez que le backend est lancé (npm run dev).'
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  const serialized = JSON.stringify(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized, delay])
  return debounced
}
