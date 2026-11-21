import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface MeterSummary {
  id: string
  name: string
  location: string | null
  createdAt: string
  readings: number
  lastIndex: number | null
  lastReadAt: string | null
  averageLitersPerDay: number | null
  usualLitersPerDay: number | null
  lastLitersPerDay: number | null
  leakAlert: boolean
  excessLitersPerDay: number
}

export interface Reading {
  id: string
  meterId: string
  value: number
  readAt: string
  source: 'ocr' | 'manuel'
  ocrConfidence: number | null
  note: string | null
  photoUrl: string | null
}

export interface Period {
  toReadingId: string
  from: string
  to: string
  days: number
  m3: number
  litersPerDay: number
  baseline: number | null
  anomaly: boolean
}

export interface MeterHistory {
  meter: { id: string; name: string; location: string | null }
  readings: Reading[]
  periods: Period[]
  stats: Omit<MeterSummary, 'id' | 'name' | 'location' | 'createdAt'>
  rule: { ratio: number; minExcessLitersPerDay: number }
  advice: string
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['meter'] })

export function useMeters() {
  return useQuery({ queryKey: ['meter', 'list'], queryFn: async () => (await api.get<MeterSummary[]>('/meter/meters')).data })
}

export function useMeterHistory(meterId: string | null) {
  return useQuery({
    queryKey: ['meter', 'history', meterId],
    queryFn: async () => (await api.get<MeterHistory>('/meter/history', { params: { meterId } })).data,
    enabled: Boolean(meterId),
  })
}

export function useSaveMeter() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: { id?: string; name: string; location?: string }) =>
      id ? (await api.patch(`/meter/meters/${id}`, input)).data : (await api.post<{ id: string }>('/meter/meters', input)).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteMeter() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => (await api.delete(`/meter/meters/${id}`)).data, onSuccess: () => invalidate(qc) })
}

export function useAddReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { meterId: string; value: number; readAt: string; source: 'ocr' | 'manuel'; ocrConfidence?: number; note?: string; photo?: File | null }) => {
      const form = new FormData()
      form.append('meterId', input.meterId)
      form.append('value', String(input.value))
      form.append('readAt', input.readAt)
      form.append('source', input.source)
      if (input.ocrConfidence !== undefined) form.append('ocrConfidence', String(input.ocrConfidence))
      if (input.note) form.append('note', input.note)
      if (input.photo) form.append('photo', input.photo)
      return (await api.post<Reading>('/meter/reading', form)).data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useUpdateReading() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; value?: number; readAt?: string; note?: string }) => (await api.patch<Reading>(`/meter/reading/${id}`, patch)).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteReading() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => (await api.delete(`/meter/reading/${id}`)).data, onSuccess: () => invalidate(qc) })
}
