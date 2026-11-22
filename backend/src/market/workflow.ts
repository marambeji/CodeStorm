import type { Role } from '../auth/auth.module.js'

/**
 * Circuit d'une commande, de la ferme au client.
 *
 *   en_attente ──(agriculteur accepte)──▶ acceptee ──(agriculteur : prête)──▶ prete
 *        │                                                                     │
 *        ├─(agriculteur refuse)──▶ refusee                     (livreur prend en charge)
 *        └─(client annule)───────▶ annulee                                     ▼
 *                                                                       prise_en_charge
 *                                                                              │ (livreur récupère à la ferme)
 *                                                                              ▼
 *                                                     livree ◀──(livreur + code client)── en_livraison
 *
 * Toutes les règles sont ici (fonctions pures, testées) : le service ne fait qu'appliquer.
 */

export const ORDER_STATUSES = ['en_attente', 'acceptee', 'prete', 'prise_en_charge', 'en_livraison', 'livree', 'refusee', 'annulee'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_ACTIONS = ['accepter', 'refuser', 'preparer', 'annuler', 'prendre', 'recuperer', 'livrer'] as const
export type OrderAction = (typeof ORDER_ACTIONS)[number]

interface Transition {
  from: OrderStatus
  to: OrderStatus
  role: Role
}

export const TRANSITIONS: Record<OrderAction, Transition> = {
  accepter: { from: 'en_attente', to: 'acceptee', role: 'agriculteur' },
  refuser: { from: 'en_attente', to: 'refusee', role: 'agriculteur' },
  preparer: { from: 'acceptee', to: 'prete', role: 'agriculteur' },
  annuler: { from: 'en_attente', to: 'annulee', role: 'client' },
  prendre: { from: 'prete', to: 'prise_en_charge', role: 'livreur' },
  recuperer: { from: 'prise_en_charge', to: 'en_livraison', role: 'livreur' },
  livrer: { from: 'en_livraison', to: 'livree', role: 'livreur' },
}

/** Statuts qui remettent les quantités en stock (la commande n'aura jamais lieu) */
export const RESTOCKING: OrderStatus[] = ['refusee', 'annulee']
export const FINAL: OrderStatus[] = ['livree', 'refusee', 'annulee']
/** Le livreur est sur la route : sa position est partagée avec le client et la ferme */
export const ON_THE_ROAD: OrderStatus[] = ['prise_en_charge', 'en_livraison']

/** Qui participe à la commande, vu par l'utilisateur connecté */
export interface Viewer {
  role: Role
  isClient: boolean
  isFarmer: boolean
  isCourier: boolean
}

export type TransitionCheck = { ok: true; to: OrderStatus } | { ok: false; reason: 'role' | 'status' | 'owner'; message: string }

const ACTION_LABEL: Record<OrderAction, string> = {
  accepter: 'accepter',
  refuser: 'refuser',
  preparer: 'marquer comme prête',
  annuler: 'annuler',
  prendre: 'prendre en charge',
  recuperer: 'marquer comme récupérée',
  livrer: 'marquer comme livrée',
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  en_attente: 'En attente',
  acceptee: 'Acceptée',
  prete: 'Prête à livrer',
  prise_en_charge: 'Livreur en route vers la ferme',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  refusee: 'Refusée',
  annulee: 'Annulée',
}

/** Vérifie qu'une action est permise : bon rôle, bonne personne, bon statut */
export function checkTransition(action: OrderAction, status: OrderStatus, viewer: Viewer): TransitionCheck {
  const t = TRANSITIONS[action]
  if (viewer.role !== t.role) return { ok: false, reason: 'role', message: `Seul un compte ${t.role} peut ${ACTION_LABEL[action]} une commande.` }
  // Le livreur prend une commande libre ; pour le reste, il faut être la personne concernée
  const owner = action === 'prendre' ? true : t.role === 'agriculteur' ? viewer.isFarmer : t.role === 'client' ? viewer.isClient : viewer.isCourier
  if (!owner) return { ok: false, reason: 'owner', message: 'Cette commande ne vous concerne pas.' }
  if (status !== t.from)
    return { ok: false, reason: 'status', message: `Impossible ${/^[aeiouy]/.test(ACTION_LABEL[action]) ? 'd’' : 'de '}${ACTION_LABEL[action]} une commande « ${STATUS_LABEL[status]} ».` }
  return { ok: true, to: t.to }
}

/** Actions que l'utilisateur peut faire maintenant (pour afficher les bons boutons) */
export function availableActions(status: OrderStatus, viewer: Viewer, hasCourier: boolean): OrderAction[] {
  return ORDER_ACTIONS.filter((a) => checkTransition(a, status, viewer).ok && !(a === 'prendre' && hasCourier))
}

// ─────────────────────────────── Prix et quantités ───────────────────────────────

export const UNITS = ['kg', 'litre', 'piece', 'botte', 'caisse'] as const
export type Unit = (typeof UNITS)[number]
export const CATEGORIES = ['legumes', 'fruits', 'cereales', 'huiles', 'dattes', 'miel', 'autres'] as const

/** Unités vendues à l'unité entière (on ne vend pas 1,5 caisse) */
const WHOLE_UNITS: Unit[] = ['piece', 'botte', 'caisse']

export function checkQuantity(unit: string, quantity: number): string | null {
  if (!(quantity > 0)) return 'La quantité doit être positive.'
  if (WHOLE_UNITS.includes(unit as Unit) && !Number.isInteger(quantity)) return `Ce produit se vend à l’unité entière (${unit}).`
  if (Math.round(quantity * 10) !== quantity * 10) return 'La quantité se règle par pas de 0,1.'
  return null
}

/** Livraison : 3 € par commande, offerte dès 40 € d'achats chez la même ferme */
export const DELIVERY = { fee: 3, freeFrom: 40 }

export const round2 = (n: number) => Math.round(n * 100) / 100

export function orderTotals(lines: { unitPrice: number; quantity: number }[]) {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  const deliveryFee = subtotal >= DELIVERY.freeFrom ? 0 : DELIVERY.fee
  return { subtotal, deliveryFee, total: round2(subtotal + deliveryFee) }
}
