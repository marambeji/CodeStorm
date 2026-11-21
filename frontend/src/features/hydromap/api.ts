import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Forecast, Observation, ObservationType, Overview, Zones } from './types'

export function useZones() {
  return useQuery({ queryKey: ['hydro', 'zones'], queryFn: async () => (await api.get<Zones>('/hydro/zones')).data, staleTime: 5 * 60_000 })
}

export function useOverview() {
  return useQuery({ queryKey: ['hydro', 'overview'], queryFn: async () => (await api.get<Overview>('/hydro/overview')).data, staleTime: 5 * 60_000 })
}

export function useForecast(zoneId: string | null) {
  return useQuery({
    queryKey: ['hydro', 'forecast', zoneId],
    queryFn: async () => (await api.get<Forecast>('/hydro/forecast', { params: { zoneId } })).data,
    enabled: Boolean(zoneId),
  })
}

export function useZoneSummary(zoneId: string | null) {
  return useQuery({
    queryKey: ['hydro', 'summary', zoneId],
    queryFn: async () => (await api.get<{ summary: string; actions: string[] }>(`/hydro/zones/${zoneId}/summary`)).data,
    enabled: Boolean(zoneId),
  })
}

export function useObservations(zoneId: string | null) {
  return useQuery({
    queryKey: ['hydro', 'observations', zoneId],
    queryFn: async () => (await api.get<Observation[]>('/hydro/observations', { params: { zoneId } })).data,
    enabled: Boolean(zoneId),
  })
}

export interface ObservationInput {
  zoneId: string
  type: ObservationType
  note: string
  waterLevelM: number | null
  observedAt: string
}

export function useSaveObservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: ObservationInput & { id?: string }) =>
      id ? (await api.patch<Observation>(`/hydro/observations/${id}`, input)).data : (await api.post<Observation>('/hydro/observations', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hydro', 'observations'] }),
  })
}

export function useDeleteObservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/hydro/observations/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['hydro', 'observations'] }),
  })
}
