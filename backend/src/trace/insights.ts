import type { Freshness } from './freshness.js'

/**
 * IA d'aide à la décision : prédiction de la demande et recommandations anti-pertes.
 * Modèles volontairement simples et explicables (régression linéaire + lissage exponentiel),
 * calculés sur les ventes réelles du marché EcoNexus.
 */

export interface DemandForecast {
  category: string
  /** Quantités vendues par semaine, de la plus ancienne à la plus récente */
  history: number[]
  /** Quantité prévue la semaine prochaine */
  forecast: number
  trend: 'hausse' | 'baisse' | 'stable'
  /** Variation par semaine (régression) */
  slope: number
}

export const CATEGORY_LABEL: Record<string, string> = { legumes: 'légumes', fruits: 'fruits', dattes: 'dattes', huiles: 'huiles', cereales: 'céréales', miel: 'miel', autres: 'autres produits' }
const label = (c: string) => CATEGORY_LABEL[c] ?? c

const round1 = (n: number) => Math.round(n * 10) / 10

/** Prévision de la semaine suivante : 60 % régression linéaire, 40 % lissage exponentiel */
export function forecastSeries(series: number[]): { forecast: number; slope: number; trend: DemandForecast['trend'] } {
  const n = series.length
  if (!n) return { forecast: 0, slope: 0, trend: 'stable' }
  const xm = (n - 1) / 2
  const ym = series.reduce((s, y) => s + y, 0) / n
  let num = 0
  let den = 0
  series.forEach((y, x) => {
    num += (x - xm) * (y - ym)
    den += (x - xm) ** 2
  })
  const slope = den ? num / den : 0
  const regression = ym + slope * (n - xm)
  let ema = series[0]
  for (const y of series.slice(1)) ema = 0.5 * y + 0.5 * ema
  const forecast = Math.max(0, 0.6 * regression + 0.4 * ema)
  const rel = ym > 0 ? slope / ym : 0
  return { forecast: round1(forecast), slope: round1(slope), trend: rel > 0.05 ? 'hausse' : rel < -0.05 ? 'baisse' : 'stable' }
}

/** Regroupe des ventes par semaine (index 0 = il y a `weeks` semaines, dernier = semaine en cours) */
export function weeklyBuckets(sales: { at: Date; quantity: number }[], weeks: number, now = new Date()): number[] {
  const buckets = Array.from({ length: weeks }, () => 0)
  const WEEK = 7 * 86_400_000
  for (const s of sales) {
    const age = Math.floor((now.getTime() - s.at.getTime()) / WEEK)
    if (age >= 0 && age < weeks) buckets[weeks - 1 - age] += s.quantity
  }
  return buckets.map(round1)
}

export interface LotView {
  code: string
  product: string
  category: string
  quantity: number
  unit: string
  stage: string
  harvestDate: Date
  freshness: Freshness
  /** Plus petite quantité constatée le long de la chaîne */
  lastQuantity: number
  blocks: { stage: string; createdAt: Date; temperature: number | null }[]
}

export interface Recommendation {
  severity: 'critique' | 'attention' | 'conseil'
  title: string
  detail: string
  lotCode?: string
}

const DAY = 86_400_000

/** Recommandations pour réduire les pertes, triées de la plus urgente à la moins urgente */
export function recommendations(lots: LotView[], demand: DemandForecast[], now = new Date()): Recommendation[] {
  const out: Recommendation[] = []
  const open = lots.filter((l) => l.stage !== 'vente')

  for (const l of open) {
    const f = l.freshness
    if (f.level === 'perime') {
      out.push({ severity: 'critique', lotCode: l.code, title: `${l.product} (${l.code}) a dépassé sa durée de conservation`, detail: 'Retirez-le de la vente. S’il est encore sain, orientez-le vers la transformation (confiture, sauce, compost, alimentation animale).' })
    } else if (f.level === 'limite' || f.level === 'a-consommer-vite') {
      out.push({ severity: f.level === 'limite' ? 'critique' : 'attention', lotCode: l.code, title: `Écouler ${l.product} (${l.code}) en priorité`, detail: `Plus que ${f.remainingDays.toLocaleString('fr-FR')} jour(s) de conservation estimée. Proposez une promotion, la vente directe sur le marché EcoNexus ou un don aux associations.` })
    }
    if (f.maxTempC !== null && f.maxTempC > f.idealC + 6) {
      out.push({ severity: 'attention', lotCode: l.code, title: `Chaîne du froid rompue pour ${l.code}`, detail: `Température relevée jusqu’à ${f.maxTempC} °C (idéal : ${f.idealC} °C). Chaque +10 °C double la vitesse de dégradation : utilisez un véhicule ou un local réfrigéré.` })
    }
    const lossPct = l.quantity > 0 ? ((l.quantity - l.lastQuantity) / l.quantity) * 100 : 0
    if (lossPct >= 5) {
      out.push({ severity: lossPct >= 15 ? 'critique' : 'attention', lotCode: l.code, title: `${Math.round(lossPct)} % de pertes sur ${l.code}`, detail: 'Des quantités ont été perdues entre deux acteurs. Vérifiez l’emballage (caisses ventilées, pas de surcharge) et la manutention au chargement.' })
    }
    const waitingDays = (now.getTime() - l.harvestDate.getTime()) / DAY
    if (l.stage === 'recolte' && f.shelfLifeDays <= 30 && waitingDays >= 1) {
      out.push({ severity: 'attention', lotCode: l.code, title: `Planifier la collecte de ${l.code}`, detail: `Récolté il y a ${Math.floor(waitingDays)} jour(s) et toujours à la ferme. Un produit frais perd l’essentiel de sa valeur dans les premiers jours : organisez l’enlèvement.` })
    }
    if (!f.measured && f.shelfLifeDays <= 30) {
      out.push({ severity: 'conseil', lotCode: l.code, title: `Mesurer la température de ${l.code}`, detail: 'Aucune température n’a été relevée : la fraîcheur affichée est une estimation optimiste. Indiquez la température à chaque étape pour une prédiction fiable.' })
    }
  }

  // Offre (lots en circulation) face à la demande prévue
  const supply = new Map<string, number>()
  for (const l of open.filter((x) => x.freshness.level !== 'perime')) supply.set(l.category, (supply.get(l.category) ?? 0) + l.lastQuantity)
  for (const d of demand) {
    const s = supply.get(d.category) ?? 0
    if (s > 0 && d.forecast > 0 && s > d.forecast * 1.5) {
      out.push({ severity: 'attention', title: `Surplus probable : ${label(d.category)}`, detail: `${round1(s)} unités en circulation pour une demande prévue de ${d.forecast} la semaine prochaine. Étalez les récoltes, proposez des lots promotionnels ou cherchez d’autres distributeurs.` })
    } else if (d.forecast > 0 && s < d.forecast * 0.5 && d.trend !== 'baisse') {
      out.push({ severity: 'conseil', title: `Demande supérieure à l’offre : ${label(d.category)}`, detail: `Demande prévue : ${d.forecast} (tendance ${d.trend}). Il reste une opportunité de vente : planifiez une récolte ou un approvisionnement.` })
    }
  }

  const order = { critique: 0, attention: 1, conseil: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}
