/**
 * Moteur FactureIA : lecture du texte d'une facture + calculs tarifaires.
 * Tout est déterministe (expressions régulières, formules) : le LLM ne fait qu'expliquer.
 */

/**
 * Tarifs de référence (ordres de grandeur indicatifs d'un tarif réglementé, TTC).
 * Ils servent à décomposer la facture et au simulateur d'économies du frontend
 * (exposés par GET /api/invoice/tariffs : une seule source de vérité).
 */
export const TARIFFS = {
  baseKwh: 0.2516, // €/kWh option Base
  hpKwh: 0.27, // €/kWh heures pleines
  hcKwh: 0.2068, // €/kWh heures creuses
  /** Abonnement mensuel TTC selon la puissance souscrite (kVA) */
  subscriptionMonthly: { 3: 9.69, 6: 12.68, 9: 15.89, 12: 19.11 } as Record<number, number>,
  /** Consommations typiques des usages (pour le simulateur) */
  usages: {
    washingMachineKwh: 0.9, // par cycle à 40 °C
    dishwasherKwh: 1.1, // par cycle
    waterHeaterKwhPerDay: 4.5, // chauffe-eau électrique de 200 L
    heatingShareOfBill: 0.45, // part du chauffage dans un logement chauffé à l'électricité
    heatingSavingPerDegree: 0.07, // -1 °C ≈ -7 % de chauffage
    ledSavingPerBulbKwhYear: 30, // ampoule halogène 40 W → LED 5 W, ~3 h/jour
  },
}

export interface InvoiceFields {
  supplier: string | null
  periodStart: Date | null
  periodEnd: Date | null
  kwh: number | null
  hpKwh: number | null
  hcKwh: number | null
  amount: number | null
  subscriptionKva: number | null
}

/** Nombre français "1 234,56" → 1234.56 (espaces fines, insécables, points de milliers…) */
export function parseFrenchNumber(raw: string): number | null {
  const cleaned = raw.replace(/[\s  ]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseDate(raw: string): Date | null {
  const m = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (!m) return null
  const year = Number(m[3].length === 2 ? `20${m[3]}` : m[3])
  const d = new Date(Date.UTC(year, Number(m[2]) - 1, Number(m[1])))
  return Number.isNaN(d.getTime()) ? null : d
}

const NUM = String.raw`(\d{1,3}(?:[\s  .]\d{3})*(?:,\d+)?|\d+(?:[.,]\d+)?)`

/**
 * Extrait les informations d'une facture d'électricité à partir de son texte.
 * Couvre les formulations les plus courantes ; ce qui n'est pas trouvé reste à null
 * et l'utilisateur le complète dans le formulaire.
 */
export function parseInvoiceText(text: string): InvoiceFields {
  const t = text.replace(/\r/g, '')
  const find = (re: RegExp) => t.match(re)?.[1] ?? null

  // Période : "du 01/09/2026 au 31/10/2026" ou "Période : 01/09/2026 - 31/10/2026"
  const period = t.match(/(?:du|période[^\d]{0,20})\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})\s*(?:au|-|–)\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i)
  const hp = find(new RegExp(String.raw`heures?\s+pleines?[^\n\d]{0,40}${NUM}\s*kwh`, 'i'))
  const hc = find(new RegExp(String.raw`heures?\s+creuses?[^\n\d]{0,40}${NUM}\s*kwh`, 'i'))
  const total =
    find(new RegExp(String.raw`consommation\s+(?:totale|facturée|du\s+relevé)?[^\n\d]{0,30}${NUM}\s*kwh`, 'i')) ??
    find(new RegExp(String.raw`total[^\n\d]{0,20}${NUM}\s*kwh`, 'i'))
  const amount =
    find(new RegExp(String.raw`(?:total\s*(?:ttc|à\s*payer)|montant\s*(?:ttc|à\s*payer|total))[^\n\d]{0,30}${NUM}\s*(?:€|eur)`, 'i')) ??
    find(new RegExp(String.raw`net\s+à\s+payer[^\n\d]{0,30}${NUM}`, 'i'))
  const kva = find(/(\d{1,2})\s*kva/i)
  const supplier = find(/(?:fournisseur|émis par|votre fournisseur)\s*:?\s*([^\n]{2,40})/i)

  const hpKwh = hp ? parseFrenchNumber(hp) : null
  const hcKwh = hc ? parseFrenchNumber(hc) : null
  let kwh = total ? parseFrenchNumber(total) : null
  if (kwh === null && hpKwh !== null && hcKwh !== null) kwh = hpKwh + hcKwh

  return {
    supplier: supplier?.trim() ?? null,
    periodStart: period ? parseDate(period[1]) : null,
    periodEnd: period ? parseDate(period[2]) : null,
    kwh,
    hpKwh,
    hcKwh,
    amount: amount ? parseFrenchNumber(amount) : null,
    subscriptionKva: kva ? Number(kva) : null,
  }
}

export interface InvoiceData {
  periodStart: Date
  periodEnd: Date
  kwh: number
  hpKwh: number | null
  hcKwh: number | null
  amount: number
  subscriptionKva: number | null
}

const DAY = 86_400_000
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d

/**
 * Décompose le montant par poste et calcule les indicateurs utiles :
 * prix moyen du kWh, consommation par jour, projection sur un an, évolution.
 */
export function analyzeInvoice(inv: InvoiceData, previous?: InvoiceData | null) {
  const days = Math.max(1, Math.round((inv.periodEnd.getTime() - inv.periodStart.getTime()) / DAY) + 1)
  const months = days / 30.4
  const offer: 'base' | 'hphc' = inv.hpKwh !== null && inv.hcKwh !== null ? 'hphc' : 'base'
  const kva = inv.subscriptionKva ?? 6
  const subscription = round((TARIFFS.subscriptionMonthly[kva] ?? TARIFFS.subscriptionMonthly[6]) * months)

  const energyLines =
    offer === 'hphc'
      ? [
          { label: 'Heures pleines', kwh: inv.hpKwh!, unitPrice: TARIFFS.hpKwh, amount: round(inv.hpKwh! * TARIFFS.hpKwh) },
          { label: 'Heures creuses', kwh: inv.hcKwh!, unitPrice: TARIFFS.hcKwh, amount: round(inv.hcKwh! * TARIFFS.hcKwh) },
        ]
      : [{ label: 'Consommation', kwh: inv.kwh, unitPrice: TARIFFS.baseKwh, amount: round(inv.kwh * TARIFFS.baseKwh) }]
  const energy = energyLines.reduce((s, l) => s + l.amount, 0)
  // Taxes et contributions : ce qui reste du montant réel (jamais négatif)
  const taxes = round(Math.max(0, inv.amount - subscription - energy))

  const tiers = [
    { label: `Abonnement ${kva} kVA`, kwh: null, unitPrice: null, amount: subscription },
    ...energyLines,
    { label: 'Taxes et contributions', kwh: null, unitPrice: null, amount: taxes },
  ]

  const prevDaily = previous ? previous.kwh / Math.max(1, Math.round((previous.periodEnd.getTime() - previous.periodStart.getTime()) / DAY) + 1) : null
  const daily = inv.kwh / days

  return {
    offer,
    days,
    tiers,
    pricePerKwh: round(inv.amount / Math.max(inv.kwh, 1), 4),
    kwhPerDay: round(daily, 1),
    projectedYearlyKwh: Math.round(daily * 365),
    projectedYearlyCost: Math.round((inv.amount / days) * 365),
    hcShare: offer === 'hphc' ? round(inv.hcKwh! / Math.max(inv.kwh, 1), 3) : null,
    /** Évolution de la consommation journalière par rapport à la facture précédente (en %) */
    changeVsPrevious: prevDaily ? round(((daily - prevDaily) / prevDaily) * 100, 1) : null,
  }
}

export type InvoiceAnalysis = ReturnType<typeof analyzeInvoice>

/** "Facture d’octobre 2026" / "Facture de mars 2026" (élision devant une voyelle) */
export function invoiceLabel(periodEnd: Date) {
  const month = periodEnd.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return /^[aeiouyéèâ]/i.test(month) ? `Facture d’${month}` : `Facture de ${month}`
}
