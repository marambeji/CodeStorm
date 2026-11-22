/**
 * IA de conservation : prédiction de la durée de conservation et indice de fraîcheur.
 *
 * Modèle : chaque catégorie a une durée de vie de référence à sa température idéale.
 * La dégradation accélère avec la chaleur selon la loi Q10 (×2 tous les +10 °C), utilisée
 * en agro-alimentaire pour les produits frais. On intègre la « vie consommée » sur chaque
 * intervalle entre deux étapes, à la température mesurée à la première des deux.
 */

export interface ShelfProfile {
  /** Durée de conservation à la température idéale (jours) */
  days: number
  /** Température idéale de stockage (°C) */
  idealC: number
}

export const SHELF: Record<string, ShelfProfile> = {
  legumes: { days: 7, idealC: 4 },
  fruits: { days: 10, idealC: 4 },
  dattes: { days: 180, idealC: 10 },
  huiles: { days: 540, idealC: 18 },
  cereales: { days: 365, idealC: 15 },
  miel: { days: 730, idealC: 20 },
  autres: { days: 14, idealC: 6 },
}

const Q10 = 2
const DAY = 86_400_000

/** Vitesse de vieillissement relative à la température T (1 = idéale) */
export function agingRate(tempC: number, idealC: number): number {
  return Math.max(0.5, Q10 ** ((tempC - idealC) / 10))
}

export type FreshnessLevel = 'excellente' | 'bonne' | 'a-consommer-vite' | 'limite' | 'perime'

export interface Freshness {
  shelfLifeDays: number
  idealC: number
  /** Jours de vie déjà consommés (équivalent température idéale) */
  consumedDays: number
  /** Jours restants aux conditions actuelles */
  remainingDays: number
  /** 0 → 100 */
  score: number
  level: FreshnessLevel
  expiresAt: Date
  /** Au moins une température mesurée dans la chaîne */
  measured: boolean
  /** Température la plus haute relevée */
  maxTempC: number | null
}

export interface Reading {
  at: Date
  temperature: number | null
}

export function levelOf(score: number): FreshnessLevel {
  if (score <= 0) return 'perime'
  if (score < 15) return 'limite'
  if (score < 40) return 'a-consommer-vite'
  if (score < 70) return 'bonne'
  return 'excellente'
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * @param readings étapes de la chaîne (la première est la récolte) ; sans température, on suppose
 *                 la température idéale (estimation optimiste, signalée par `measured: false`)
 */
export function predictFreshness(category: string, harvestDate: Date, readings: Reading[], now = new Date()): Freshness {
  const profile = SHELF[category] ?? SHELF.autres
  const points = [...readings].filter((r) => r.at.getTime() <= now.getTime()).sort((a, b) => a.at.getTime() - b.at.getTime())

  let consumed = 0
  let cursor = harvestDate.getTime()
  // Avant la première mesure : température relevée à la récolte si elle existe, sinon l'idéale
  let temp = points.find((p) => p.temperature !== null)?.temperature ?? profile.idealC
  for (const r of points) {
    const t = Math.max(cursor, r.at.getTime())
    consumed += ((t - cursor) / DAY) * agingRate(temp, profile.idealC)
    cursor = t
    if (r.temperature !== null) temp = r.temperature
  }
  consumed += (Math.max(0, now.getTime() - cursor) / DAY) * agingRate(temp, profile.idealC)

  const left = Math.max(0, profile.days - consumed)
  const rateNow = agingRate(temp, profile.idealC)
  const remainingDays = left / rateNow
  // Score : temps restant aux conditions actuelles, rapporté à la durée de vie idéale
  const score = Math.round(Math.min(1, remainingDays / profile.days) * 100)
  const temps = points.map((p) => p.temperature).filter((t): t is number => t !== null)

  return {
    shelfLifeDays: profile.days,
    idealC: profile.idealC,
    consumedDays: round1(consumed),
    remainingDays: round1(remainingDays),
    score,
    level: levelOf(score),
    expiresAt: new Date(now.getTime() + remainingDays * DAY),
    measured: temps.length > 0,
    maxTempC: temps.length ? Math.max(...temps) : null,
  }
}
