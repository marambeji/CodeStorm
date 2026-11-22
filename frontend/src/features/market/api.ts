import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api } from '@/lib/api'

// ─────────────────────────────── Types ───────────────────────────────

export const CATEGORIES = [
  { id: 'legumes', label: 'Légumes' },
  { id: 'fruits', label: 'Fruits' },
  { id: 'dattes', label: 'Dattes' },
  { id: 'huiles', label: 'Huiles' },
  { id: 'cereales', label: 'Céréales' },
  { id: 'miel', label: 'Miel' },
  { id: 'autres', label: 'Autres' },
] as const
export type Category = (typeof CATEGORIES)[number]['id']

export const UNITS = [
  { id: 'kg', label: 'kg', long: 'le kilo' },
  { id: 'litre', label: 'L', long: 'le litre' },
  { id: 'piece', label: 'pièce', long: 'la pièce' },
  { id: 'botte', label: 'botte', long: 'la botte' },
  { id: 'caisse', label: 'caisse', long: 'la caisse' },
] as const
export type Unit = (typeof UNITS)[number]['id']
export const WHOLE_UNITS: Unit[] = ['piece', 'botte', 'caisse']

export const unitLabel = (u: string) => UNITS.find((x) => x.id === u)?.label ?? u
export const unitLong = (u: string) => UNITS.find((x) => x.id === u)?.long ?? u
export const categoryLabel = (c: string) => CATEGORIES.find((x) => x.id === c)?.label ?? c

/** Mêmes règles que le serveur (livraison offerte dès 40 €) */
export const DELIVERY = { fee: 3, freeFrom: 40 }

export interface FarmerPublic {
  id: string
  name: string
  farmName: string | null
  placeName: string | null
}

export interface Product {
  id: string
  farmerId: string
  name: string
  category: Category
  unit: Unit
  price: number
  stock: number
  description: string | null
  origin: string | null
  harvestDate: string | null
  organic: boolean
  photoUrl: string | null
  active: boolean
  createdAt: string
  farmer?: FarmerPublic
  sold?: number
}

export type OrderStatus = 'en_attente' | 'acceptee' | 'prete' | 'prise_en_charge' | 'en_livraison' | 'livree' | 'refusee' | 'annulee'
export type OrderAction = 'accepter' | 'refuser' | 'preparer' | 'annuler' | 'prendre' | 'recuperer' | 'livrer'

/** Le livreur est sur la route (vers la ferme, puis vers le client) */
export const ON_THE_ROAD: OrderStatus[] = ['prise_en_charge', 'en_livraison']

export interface Order {
  id: string
  reference: string
  status: OrderStatus
  address: string
  deliveryLat: number | null
  deliveryLng: number | null
  pickupLat: number | null
  pickupLng: number | null
  phone: string
  note: string | null
  subtotal: number
  deliveryFee: number
  total: number
  /** Visible uniquement par le client */
  deliveryCode: string | null
  createdAt: string
  updatedAt: string
  items: { id: string; productId: string | null; name: string; unit: Unit; unitPrice: number; quantity: number; lineTotal: number }[]
  events: { id: string; status: OrderStatus; actorRole: string; actorName: string; note: string | null; createdAt: string }[]
  farmer: FarmerPublic & { phone: string | null }
  client: { id: string; name: string }
  /** `live` : position du livreur, seulement pendant le trajet de cette commande */
  courier: { id: string; name: string; phone: string | null; live: { lat: number; lng: number; at: string } | null } | null
  /** Ce que l'utilisateur connecté peut faire maintenant */
  actions: OrderAction[]
}

export interface ShopSummary {
  revenue: number
  delivered: number
  toHandle: number
  inTransit: number
  activeProducts: number
  lowStock: number
}

// ─────────────────────────────── Requêtes ───────────────────────────────

const LIVE = { refetchInterval: 20_000, refetchOnWindowFocus: true } // les autres acteurs font avancer les commandes

export function useCatalog(q: string, category: Category | null) {
  return useQuery({
    queryKey: ['market', 'catalog', q, category],
    queryFn: async () => (await api.get<Product[]>('/market/products', { params: { q: q || undefined, category: category ?? undefined } })).data,
    placeholderData: (prev) => prev,
  })
}

export function useMyProducts() {
  return useQuery({ queryKey: ['market', 'my-products'], queryFn: async () => (await api.get<Product[]>('/market/my-products')).data })
}

export function useShopSummary() {
  return useQuery({ queryKey: ['market', 'summary'], queryFn: async () => (await api.get<ShopSummary>('/market/summary')).data, ...LIVE })
}

export function useOrders() {
  return useQuery({ queryKey: ['market', 'orders'], queryFn: async () => (await api.get<Order[]>('/market/orders')).data, ...LIVE })
}

/** Une commande, rafraîchie toutes les 5 s quand on la suit en direct */
export function useOrderLive(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ['market', 'order', id],
    queryFn: async () => (await api.get<Order>(`/market/orders/${id}`)).data,
    enabled,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  })
}

export function useAvailableDeliveries() {
  return useQuery({ queryKey: ['market', 'available'], queryFn: async () => (await api.get<Order[]>('/market/deliveries/available')).data, ...LIVE })
}

const invalidate = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['market'] })

export interface ProductInput {
  name: string
  category: Category
  unit: Unit
  price: number
  stock: number
  description: string
  origin: string
  harvestDate: string // AAAA-MM-JJ ou ''
  organic: boolean
  active: boolean
  photo?: File | null
  removePhoto?: boolean
}

export function useSaveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ProductInput }) => {
      const form = new FormData()
      const { photo, ...fields } = input
      for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, String(v))
      if (photo) form.append('photo', photo)
      return id ? (await api.patch<Product>(`/market/my-products/${id}`, form)).data : (await api.post<Product>('/market/my-products', form)).data
    },
    onSuccess: () => invalidate(qc),
  })
}

export function useDeleteProduct() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => (await api.delete(`/market/my-products/${id}`)).data, onSuccess: () => invalidate(qc) })
}

export function useCheckout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { items: { productId: string; quantity: number }[]; address: string; phone: string; lat: number; lng: number; note?: string }) => (await api.post<Order[]>('/market/orders', input)).data,
    onSuccess: () => invalidate(qc),
  })
}

export function useTransition() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; action: OrderAction; code?: string; note?: string }) => (await api.post<Order>(`/market/orders/${id}/transition`, body)).data,
    onSettled: () => invalidate(qc), // même en cas de conflit : on recharge l'état réel
  })
}

// ─────────────────────────────── Position du livreur ───────────────────────────────

export type ShareState = 'off' | 'demande' | 'actif' | 'refuse' | 'indisponible'

/**
 * Pendant une tournée, le téléphone du livreur envoie sa position GPS (au plus toutes les 8 s,
 * ou dès qu'il a bougé de 30 m). Le partage s'arrête tout seul quand il n'y a plus de commande en cours.
 * Limite du navigateur : la page doit rester ouverte.
 */
export function useShareCourierPosition(active: boolean) {
  const [state, setState] = useState<ShareState>('off')
  const [position, setPosition] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const last = useRef<{ lat: number; lng: number; t: number } | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (!active) {
      setState('off')
      return
    }
    if (!('geolocation' in navigator)) {
      setState('indisponible')
      return
    }
    setState('demande')
    const send = async (lat: number, lng: number) => {
      const prev = last.current
      const now = Date.now()
      if (prev && now - prev.t < 8_000 && Math.hypot((lat - prev.lat) * 111_000, (lng - prev.lng) * 111_000 * Math.cos((lat * Math.PI) / 180)) < 30) return
      last.current = { lat, lng, t: now }
      try {
        await api.post('/market/courier/position', { lat, lng })
        qc.invalidateQueries({ queryKey: ['market', 'orders'] })
      } catch {
        /* réseau coupé : on réessaiera à la prochaine position */
      }
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setState('actif')
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy })
        void send(p.coords.latitude, p.coords.longitude)
      },
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'refuse' : 'indisponible'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [active, qc])

  return { state, position }
}

// ─────────────────────────────── Panier (navigateur) ───────────────────────────────

export interface CartLine {
  productId: string
  name: string
  unit: Unit
  price: number
  stock: number
  photoUrl: string | null
  category: Category
  farmerId: string
  farmName: string
  quantity: number
}

const CART_KEY = 'econexus-cart'
let cart: CartLine[] = load()
const listeners = new Set<() => void>()

function load(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? '[]') as CartLine[]
  } catch {
    return []
  }
}
function commit(next: CartLine[]) {
  cart = next
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(next))
  } catch {
    /* navigation privée : le panier reste en mémoire */
  }
  listeners.forEach((l) => l())
}

/** Pas d'ajout : 1 pour les pièces / bottes / caisses, 0,5 pour le kilo et le litre */
export const stepFor = (unit: Unit) => (WHOLE_UNITS.includes(unit) ? 1 : 0.5)
const clampQty = (q: number, stock: number) => Math.max(0, Math.min(Math.round(q * 10) / 10, stock))

export const cartStore = {
  add(p: Product, quantity = stepFor(p.unit)) {
    const existing = cart.find((l) => l.productId === p.id)
    if (existing) return commit(cart.map((l) => (l.productId === p.id ? { ...l, stock: p.stock, price: p.price, quantity: clampQty(l.quantity + quantity, p.stock) } : l)))
    commit([
      ...cart,
      {
        productId: p.id,
        name: p.name,
        unit: p.unit,
        price: p.price,
        stock: p.stock,
        photoUrl: p.photoUrl,
        category: p.category,
        farmerId: p.farmerId,
        farmName: p.farmer?.farmName || p.farmer?.name || 'Ferme',
        quantity: clampQty(quantity, p.stock),
      },
    ])
  },
  setQuantity(productId: string, quantity: number) {
    commit(cart.flatMap((l) => (l.productId !== productId ? [l] : quantity <= 0 ? [] : [{ ...l, quantity: clampQty(quantity, l.stock) }])))
  },
  remove(productId: string) {
    commit(cart.filter((l) => l.productId !== productId))
  },
  clear() {
    commit([])
  },
}

export function useCart() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => cart,
  )
}

/** Le panier regroupé par ferme : chaque ferme donnera une commande (et ses frais de livraison) */
export function groupCart(lines: CartLine[]) {
  const groups = new Map<string, { farmerId: string; farmName: string; lines: CartLine[] }>()
  for (const l of lines) {
    const g = groups.get(l.farmerId) ?? { farmerId: l.farmerId, farmName: l.farmName, lines: [] }
    g.lines.push(l)
    groups.set(l.farmerId, g)
  }
  return [...groups.values()].map((g) => {
    const subtotal = Math.round(g.lines.reduce((s, l) => s + l.price * l.quantity, 0) * 100) / 100
    const deliveryFee = subtotal >= DELIVERY.freeFrom ? 0 : DELIVERY.fee
    return { ...g, subtotal, deliveryFee, total: Math.round((subtotal + deliveryFee) * 100) / 100 }
  })
}

// ─────────────────────────────── Formats ───────────────────────────────

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })
export const formatPrice = (n: number) => money.format(n)
export const formatQty = (q: number, unit: string) => `${q.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unitLabel(unit)}`
export const formatDate = (iso: string, withTime = false) =>
  new Date(iso).toLocaleDateString('fr-FR', withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'long' })
