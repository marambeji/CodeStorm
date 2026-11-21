import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type IrrigationSystem = 'goutte-a-goutte' | 'aspersion' | 'gravitaire'

export interface PlanDay {
  date: string
  et0: number
  rain: number
  tMax: number
  tMin: number
  etc: number
  rainEff: number
  irrigate: boolean
  netMm: number
  volumeM3: number
  litersPerTree: number | null
  durationH: number | null
  kwh: number
  costEur: number
  reason: string
  alerts: string[]
}

export interface PlanResult {
  kc: number
  efficiency: number
  thresholdMm: number
  days: PlanDay[]
  totals: { volumeM3: number; irrigationDays: number; kwh: number; costEur: number; rainMm: number; et0Mm: number }
  comparison: { habitM3: number; savedM3: number; savedPct: number; savedKwh: number; savedEur: number }
  species: { id: string; name: string }
  weatherSource: 'open-meteo' | 'saisonnier'
  ai: { summary: string; tips: string[]; source: 'llm' | 'mock' }
  computedAt: string
}

export interface PlanInput {
  terrainId?: string
  speciesId: string
  areaM2: number
  trees?: number | null
  lat: number
  lng: number
  irrigation: IrrigationSystem
  plantingYear?: number | null
  pumpHeadM?: number
  kwhPrice?: number
}

export interface SavedPlan extends Required<Pick<PlanInput, 'speciesId' | 'areaM2' | 'lat' | 'lng' | 'irrigation' | 'pumpHeadM' | 'kwhPrice'>> {
  id: string
  name: string
  terrainId: string | null
  trees: number | null
  plantingYear: number | null
  plan: PlanResult
  doneDays: string[]
  createdAt: string
  updatedAt: string
}

const key = ['irrigation', 'plans'] as const
const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  qc.invalidateQueries({ queryKey: key })
  qc.invalidateQueries({ queryKey: ['dashboard'] })
}

export function usePlans() {
  return useQuery({ queryKey: key, queryFn: async () => (await api.get<SavedPlan[]>('/irrigation/plans')).data })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlanInput & { name: string }) => (await api.post<SavedPlan>('/irrigation/plans', input, { timeout: 40_000 })).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useRefreshPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post<SavedPlan>(`/irrigation/plans/${id}/refresh`, {}, { timeout: 40_000 })).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useSetDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, date, done }: { id: string; date: string; done: boolean }) => (await api.patch<SavedPlan>(`/irrigation/plans/${id}/day`, { date, done })).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/irrigation/plans/${id}`)).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useAskPlan() {
  return useMutation({
    mutationFn: async ({ id, question }: { id: string; question: string }) =>
      (await api.post<{ answer: string; source: 'llm' | 'mock' }>(`/irrigation/plans/${id}/ask`, { question }, { timeout: 30_000 })).data,
  })
}

export const SYSTEM_LABEL: Record<IrrigationSystem, string> = {
  'goutte-a-goutte': 'Goutte-à-goutte',
  aspersion: 'Aspersion',
  gravitaire: 'Gravitaire',
}
