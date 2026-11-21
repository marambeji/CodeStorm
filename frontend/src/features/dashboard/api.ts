import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ModuleDef } from '@/lib/modules'

export type AlertSeverity = 'critique' | 'élevée' | 'moyenne' | 'info'
export interface DashboardAlert {
  id: string
  module: ModuleDef['id']
  severity: AlertSeverity
  title: string
  detail: string
  link: string
  date: string
}

export interface Dashboard {
  ecoScore: number
  parts: { id: ModuleDef['id']; label: string; score: number; weight: number }[]
  alerts: DashboardAlert[]
  badges: { id: string; label: string; description: string; unlocked: boolean }[]
  goals: { id: string; label: string; progress: number; detail: string; link: string }[]
  modules: {
    plantdoc: { total: number; toTreat: number; healthyShare: number | null; parcels: number; latest: { id: string; disease: string; parcel: string; severity: string }[] }
    terracalc: { count: number; hectares: number; trees: number; productionKg: number; co2Kg: number }
    factureia: {
      count: number
      last: { label: string; amount: number; kwh: number; change: number | null; yearlyCost: number } | null
      series: { month: string; kwh: number; amount: number }[]
    }
    hydromap: { zones: number; levels: Record<'faible' | 'modéré' | 'élevé' | 'critique', number>; averageStress: number; worst: { name: string; stress: number } }
    aquascan: { meters: number; leaks: number; usualLitersPerDay: number; series: { date: string; liters: number; anomaly: boolean }[] }
  }
}

/** Synthèse du tableau de bord (rafraîchie toutes les minutes) */
export function useDashboard() {
  return useQuery({ queryKey: ['dashboard'], queryFn: async () => (await api.get<Dashboard>('/dashboard')).data, refetchInterval: 60_000 })
}
