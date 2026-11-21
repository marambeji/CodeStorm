import { TARIFFS, type InvoiceAnalysis, type InvoiceData } from '../invoice/invoice.engine.js'

const nf = (n: number, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d, minimumFractionDigits: d }).format(n).replace(/\u202f/g, '\u00a0')
const eur = (n: number) => `${nf(n, 2)}\u00a0€`
const date = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

/**
 * Explication et conseils FactureIA simulés : uniquement à partir des chiffres
 * extraits et calculés par le moteur (aucun montant inventé).
 */
export function mockInvoiceAdvice(inv: InvoiceData, a: InvoiceAnalysis) {
  const get = (label: string) => a.tiers.find((t) => t.label.startsWith(label))?.amount ?? 0
  const energy = a.tiers.filter((t) => t.kwh !== null).reduce((s, t) => s + t.amount, 0)

  let explanation =
    `Cette facture de ${eur(inv.amount)} couvre ${a.days} jours, du ${date(inv.periodStart)} au ${date(inv.periodEnd)}. ` +
    `Vous avez consommé ${nf(inv.kwh)} kWh, soit ${nf(a.kwhPerDay, 1)} kWh par jour, pour un prix moyen de ${nf(a.pricePerKwh, 3)} € le kWh. ` +
    `L'énergie représente ${eur(energy)}, l'abonnement ${eur(get('Abonnement'))} et les taxes ${eur(get('Taxes'))}.`
  if (a.changeVsPrevious !== null) {
    explanation +=
      a.changeVsPrevious > 0
        ? ` Votre consommation quotidienne a augmenté de ${nf(a.changeVsPrevious, 0)} % par rapport à la facture précédente.`
        : ` Votre consommation quotidienne a baissé de ${nf(-a.changeVsPrevious, 0)} % par rapport à la facture précédente\u00a0: bravo\u00a0!`
  }
  explanation += ` À ce rythme, l'année vous coûterait environ ${nf(a.projectedYearlyCost)} €.`

  const tips: string[] = []
  if (a.offer === 'hphc' && a.hcShare !== null && a.hcShare < 0.35) {
    const shift = inv.kwh * (0.35 - a.hcShare) * (365 / a.days)
    tips.push(
      `Seulement ${nf(a.hcShare * 100)} % de votre consommation est en heures creuses. En décalant lave-linge, lave-vaisselle et chauffe-eau la nuit pour atteindre 35 %, vous économiseriez environ ${nf(shift * (TARIFFS.hpKwh - TARIFFS.hcKwh))} € par an.`,
    )
  }
  if (a.offer === 'base' && a.kwhPerDay > 15) {
    // Avec 35 % en heures creuses, l'option HP/HC devient-elle intéressante ?
    const yearly = a.projectedYearlyKwh
    const hphc = yearly * (0.65 * TARIFFS.hpKwh + 0.35 * TARIFFS.hcKwh)
    const base = yearly * TARIFFS.baseKwh
    if (hphc < base) tips.push(`Avec votre niveau de consommation, l'option Heures pleines / Heures creuses ferait gagner environ ${nf(base - hphc)} € par an si 35 % de vos usages passent la nuit.`)
  }
  const kva = inv.subscriptionKva ?? 6
  if (kva >= 9 && a.kwhPerDay < 10) {
    const saving = ((TARIFFS.subscriptionMonthly[kva] ?? 0) - TARIFFS.subscriptionMonthly[6]) * 12
    if (saving > 0) tips.push(`Votre puissance (${kva} kVA) semble élevée pour votre consommation : passer à 6 kVA économiserait environ ${nf(saving)} € d'abonnement par an.`)
  }
  if (a.changeVsPrevious !== null && a.changeVsPrevious > 15) {
    tips.push('Hausse marquée : vérifiez le chauffage (thermostat, fenêtres) et les appareils restés allumés en permanence.')
  }
  tips.push('Les appareils en veille représentent souvent 5 à 10 % de la facture : une multiprise à interrupteur suffit à les couper.')
  return { explanation, tips: tips.slice(0, 4) }
}
