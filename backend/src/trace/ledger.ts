import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Registre de traçabilité « style blockchain ».
 * Chaque bloc contient le hash du bloc précédent : modifier un seul champ (lieu, date, température…)
 * change son hash et casse tous les liens suivants. La vérification recalcule toute la chaîne.
 * Le bloc d'origine est en plus scellé (HMAC) par la plateforme : c'est la certification de l'origine.
 */

export const GENESIS_PREV = '0'.repeat(64)

/** Étapes de la chaîne d'approvisionnement, dans l'ordre du schéma Agriculteur → … → Consommateur */
export const STAGES = ['recolte', 'collecte', 'transport', 'stockage', 'distribution', 'vente'] as const
export type Stage = (typeof STAGES)[number]

/** Rôle de l'acteur dans la chaîne (indépendant du rôle du compte EcoNexus) */
export const ACTOR_ROLES = ['agriculteur', 'collecteur', 'transporteur', 'distributeur', 'detaillant'] as const
export type ActorRole = (typeof ACTOR_ROLES)[number]

/** Étapes qu'un acteur peut ajouter après la récolte */
export const NEXT_STAGES = STAGES.filter((s) => s !== 'recolte')

/** Rang des étapes « jalons » : on ne revient pas en arrière (transport et stockage peuvent se répéter) */
const RANK: Partial<Record<Stage, number>> = { recolte: 0, collecte: 1, distribution: 3, vente: 4 }

export interface BlockData {
  index: number
  stage: string
  actorId: string | null
  actorRole: string
  actorName: string
  placeName: string | null
  lat: number | null
  lng: number | null
  temperature: number | null
  quantity: number | null
  note: string | null
  prevHash: string
  createdAt: Date
}

export interface Block extends BlockData {
  hash: string
}

/** Hash SHA-256 d'un bloc : champs dans un ordre fixe, liés au code du lot */
export function hashBlock(lotCode: string, b: BlockData): string {
  const canonical = JSON.stringify([
    lotCode,
    b.index,
    b.stage,
    b.actorId,
    b.actorRole,
    b.actorName,
    b.placeName,
    b.lat,
    b.lng,
    b.temperature,
    b.quantity,
    b.note,
    b.prevHash,
    b.createdAt.toISOString(),
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

export interface ChainCheck {
  valid: boolean
  length: number
  /** Index du premier bloc invalide, ou null */
  brokenAt: number | null
  reason: string | null
}

/** Recalcule toute la chaîne d'un lot */
export function verifyChain(lotCode: string, blocks: Block[]): ChainCheck {
  const sorted = [...blocks].sort((a, b) => a.index - b.index)
  if (!sorted.length) return { valid: false, length: 0, brokenAt: 0, reason: 'Aucun bloc d’origine.' }
  let prev = GENESIS_PREV
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i]
    if (b.index !== i) return { valid: false, length: sorted.length, brokenAt: i, reason: `Bloc ${i} manquant.` }
    if (b.prevHash !== prev) return { valid: false, length: sorted.length, brokenAt: i, reason: `Le bloc ${i} ne pointe pas vers le bloc précédent.` }
    if (hashBlock(lotCode, b) !== b.hash) return { valid: false, length: sorted.length, brokenAt: i, reason: `Le contenu du bloc ${i} a été modifié.` }
    prev = b.hash
  }
  return { valid: true, length: sorted.length, brokenAt: null, reason: null }
}

/** Sceau de certification de l'origine : HMAC(code du lot, hash d'origine, agriculteur) */
export function sealOrigin(secret: string, lotCode: string, genesisHash: string, farmerId: string): string {
  return createHmac('sha256', secret).update(`${lotCode}|${genesisHash}|${farmerId}`).digest('hex')
}

export function checkSeal(secret: string, seal: string, lotCode: string, genesisHash: string, farmerId: string): boolean {
  const expected = Buffer.from(sealOrigin(secret, lotCode, genesisHash, farmerId), 'hex')
  const given = Buffer.from(seal, 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Peut-on ajouter cette étape après celles déjà enregistrées ? (null = oui, sinon le message d'erreur) */
export function checkNextStage(previous: string[], next: string): string | null {
  if (!(NEXT_STAGES as readonly string[]).includes(next)) return 'Étape inconnue.'
  if (previous.includes('vente')) return 'Ce lot a déjà été vendu au consommateur : la chaîne est close.'
  const max = Math.max(...previous.map((s) => RANK[s as Stage] ?? -1))
  const rank = RANK[next as Stage]
  if (rank !== undefined && rank < max) return `Impossible d’enregistrer « ${next} » après une étape plus avancée.`
  return null
}
