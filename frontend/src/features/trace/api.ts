import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ─────────────────────────────── Types ───────────────────────────────

export type Stage = 'recolte' | 'collecte' | 'transport' | 'stockage' | 'distribution' | 'vente'
export type ActorRole = 'agriculteur' | 'collecteur' | 'transporteur' | 'distributeur' | 'detaillant'
export type FreshnessLevel = 'excellente' | 'bonne' | 'a-consommer-vite' | 'limite' | 'perime'

export const STAGES: { id: Stage; label: string; hint: string; role: ActorRole }[] = [
  { id: 'recolte', label: 'Récolte', hint: 'Le lot est récolté à la ferme', role: 'agriculteur' },
  { id: 'collecte', label: 'Collecte', hint: 'Le collecteur récupère le lot à la ferme', role: 'collecteur' },
  { id: 'transport', label: 'Transport', hint: 'Le lot est en route', role: 'transporteur' },
  { id: 'stockage', label: 'Stockage', hint: 'Entrepôt ou chambre froide', role: 'collecteur' },
  { id: 'distribution', label: 'Distribution', hint: 'Le distributeur réceptionne le lot', role: 'distributeur' },
  { id: 'vente', label: 'Vente', hint: 'Mis en vente au consommateur', role: 'detaillant' },
]
export const stageLabel = (s: string) => STAGES.find((x) => x.id === s)?.label ?? s

export const ACTOR_ROLES: { id: ActorRole; label: string }[] = [
  { id: 'agriculteur', label: 'Agriculteur' },
  { id: 'collecteur', label: 'Collecteur' },
  { id: 'transporteur', label: 'Transporteur' },
  { id: 'distributeur', label: 'Distributeur' },
  { id: 'detaillant', label: 'Point de vente' },
]
export const actorLabel = (r: string) => ACTOR_ROLES.find((x) => x.id === r)?.label ?? r

export interface TraceBlock {
  id?: string
  index: number
  stage: Stage
  actorRole: ActorRole
  actorName: string
  placeName: string | null
  lat: number | null
  lng: number | null
  temperature: number | null
  quantity: number | null
  note: string | null
  prevHash: string
  hash: string
  createdAt: string
}

export interface Freshness {
  shelfLifeDays: number
  idealC: number
  consumedDays: number
  remainingDays: number
  score: number
  level: FreshnessLevel
  expiresAt: string
  measured: boolean
  maxTempC: number | null
}

export interface Verification {
  valid: boolean
  length: number
  brokenAt: number | null
  reason: string | null
  certified: boolean
  lastHash: string | null
}

export interface HarvestLot {
  id?: string
  code: string
  product: string
  category: string
  variety: string | null
  quantity: number
  currentQuantity: number
  unit: string
  parcel: string | null
  placeName: string | null
  lat: number | null
  lng: number | null
  harvestDate: string
  organic: boolean
  notes: string | null
  certificate: string
  stage: Stage
  stageLabel: string
  createdAt: string
  farmer: { name: string; farmName: string | null; placeName: string | null }
  blocks: TraceBlock[]
  freshness: Freshness
  verification: Verification
  handovers: { from: string; to: string; fromRole: string; toRole: string; stage: Stage; at: string }[]
}

export interface DemandForecast {
  category: string
  history: number[]
  forecast: number
  trend: 'hausse' | 'baisse' | 'stable'
  slope: number
}

export interface Recommendation {
  severity: 'critique' | 'attention' | 'conseil'
  title: string
  detail: string
  lotCode?: string
}

export interface Insights {
  demand: DemandForecast[]
  recommendations: Recommendation[]
  stats: { lots: number; inTransit: number; atRisk: number; avgFreshness: number | null; lossQuantity: number }
}

export interface LotInput {
  product: string
  category: string
  variety?: string
  quantity: number
  unit: string
  parcel?: string
  placeName?: string
  lat?: number
  lng?: number
  harvestDate: string
  organic?: boolean
  temperature?: number
  notes?: string
}

export interface StepInput {
  stage: Exclude<Stage, 'recolte'>
  actorRole: ActorRole
  organization?: string
  placeName?: string
  lat?: number
  lng?: number
  temperature?: number
  quantity?: number
  note?: string
}

export interface RoutePoint {
  lat: number
  lng: number
  label?: string
}

export interface OptimizedRoute {
  order: number[]
  distanceKm: number
  durationMin: number
  naiveKm: number
  savedKm: number
  savedPct: number
  stops: (RoutePoint & { index: number })[]
}

// ─────────────────────────────── Requêtes ───────────────────────────────

export function useMyLots() {
  return useQuery({ queryKey: ['trace', 'lots'], queryFn: async () => (await api.get<HarvestLot[]>('/trace/lots')).data })
}

export function useLot(code: string | null) {
  return useQuery({ queryKey: ['trace', 'lot', code], enabled: Boolean(code), retry: false, queryFn: async () => (await api.get<HarvestLot>(`/trace/lots/${encodeURIComponent(code!)}`)).data })
}

/** Page consommateur (sans connexion) */
export function usePublicLot(code: string | undefined) {
  return useQuery({ queryKey: ['trace', 'public', code], enabled: Boolean(code), retry: false, queryFn: async () => (await api.get<HarvestLot>(`/trace/public/${encodeURIComponent(code!)}`)).data })
}

export function useInsights() {
  return useQuery({ queryKey: ['trace', 'insights'], queryFn: async () => (await api.get<Insights>('/trace/insights')).data })
}

export function useCreateLot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: LotInput) => (await api.post<HarvestLot>('/trace/lots', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trace'] }),
  })
}

export function useAddStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ code, ...input }: StepInput & { code: string }) => (await api.post<HarvestLot>(`/trace/lots/${encodeURIComponent(code)}/steps`, input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trace'] }),
  })
}

export function useOptimizeRoute() {
  return useMutation({
    mutationFn: async (input: { start: RoutePoint; stops: RoutePoint[]; returnToStart?: boolean }) => (await api.post<OptimizedRoute>('/trace/route', input)).data,
  })
}

// ─────────────────────────────── Utilitaires ───────────────────────────────

/** URL publique encodée dans le QR code du lot */
export const publicLotUrl = (code: string) => `${window.location.origin}/trace/${code}`

/** Extrait un code de lot d'un texte scanné (URL du QR, code complet ou court) */
export function parseLotCode(raw: string): string | null {
  const text = raw.trim().toUpperCase()
  // QR code ou saisie complète : « LOT-XXXXXX » n'importe où (ex : URL de la page publique)
  const full = text.match(/(?:^|[^A-Z0-9])LOT-([A-Z2-9]{6})(?![A-Z0-9])/)
  if (full) return `LOT-${full[1]}`
  // Saisie courte : les 6 caractères seuls
  return /^[A-Z2-9]{6}$/.test(text) ? `LOT-${text}` : null
}

/** Lots encore en circulation (à collecter, transporter, distribuer) */
export function useOpenLots(enabled = true) {
  return useQuery({ queryKey: ['trace', 'open'], enabled, queryFn: async () => (await api.get<HarvestLot[]>('/trace/open')).data })
}
