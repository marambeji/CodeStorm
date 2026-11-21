import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Catalog, Diagnosis, DiagnosisStatus } from './types'

const keys = { catalog: ['plant', 'catalog'] as const, history: ['plant', 'history'] as const }

export function useCatalog() {
  return useQuery({ queryKey: keys.catalog, queryFn: async () => (await api.get<Catalog>('/plant/catalog')).data, staleTime: Infinity })
}

export function useHistory() {
  return useQuery({ queryKey: keys.history, queryFn: async () => (await api.get<Diagnosis[]>('/plant/history')).data })
}

export function useDiagnose() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { image: File; crop: string; diseaseKey?: string; confidence?: number; affectedRatio?: number }) => {
      // Envoi multipart : la photo + le résultat du modèle de vision
      const form = new FormData()
      form.append('image', input.image)
      if (input.crop) form.append('crop', input.crop)
      if (input.diseaseKey) {
        form.append('diseaseKey', input.diseaseKey)
        form.append('confidence', String(input.confidence))
        form.append('affectedRatio', String(input.affectedRatio))
      }
      return (await api.post<Diagnosis>('/plant/diagnose', form, { timeout: 45_000 })).data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.history }),
  })
}

export function useUpdateDiagnosis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; parcel?: string; status?: DiagnosisStatus; notes?: string }) =>
      (await api.patch<Diagnosis>(`/plant/${id}`, patch)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.history }),
  })
}

export function useDeleteDiagnosis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/plant/${id}`)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.history }),
  })
}

export function useAsk() {
  return useMutation({ mutationFn: async ({ id, question }: { id: string; question: string }) => (await api.post<{ answer: string }>(`/plant/${id}/ask`, { question })).data })
}
