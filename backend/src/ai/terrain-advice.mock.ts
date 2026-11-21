import type { Estimate, SpeciesRef } from '../terrain/estimation.js'

export interface AiAdvice {
  summary: string
  tips: string[]
  /** 0 → 1 : à quel point l'estimation est fiable vu les données disponibles */
  confidence: number
  source: 'mock' | 'llm'
}

// Espace fine (U+202F) remplacée par une espace insécable classique : mieux supportée par les polices
const nf = (n: number, d = 0) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d }).format(n).replace(/\u202f/g, '\u00a0')
const tonnes = (kg: number) => (kg >= 1000 ? `${nf(kg / 1000, 1)} t` : `${nf(kg)} kg`)
const IRRIGATION_LABEL: Record<string, string> = {
  'goutte-a-goutte': 'au goutte-à-goutte',
  aspersion: 'par aspersion',
  gravitaire: 'gravitaire',
  pluvial: 'sans irrigation',
}

/**
 * Conseils "IA" simulés pour TerraCalc : utilisés tant qu'aucune clé LLM n'est configurée.
 * Ils sont construits UNIQUEMENT à partir des chiffres déjà calculés par le moteur
 * (aucun chiffre inventé), avec des règles simples d'agronomie.
 */
export function mockTerrainAdvice(e: Estimate, s: SpeciesRef): AiAdvice {
  const ha = e.geometry.areaHa
  const tips: string[] = []
  let summary: string

  if (!e.trees) {
    summary =
      `Sur ${nf(ha, 2)} ha, une campagne de ${s.name.toLowerCase()} conduite ${IRRIGATION_LABEL[e.inputs.irrigation]} ` +
      `produirait environ ${tonnes(e.production.kgPerYear)} par an, pour un chiffre d'affaires de ${nf(e.economics.revenuePerYear)} € ` +
      `et une marge d'environ ${nf(e.economics.netPerYear)} € après les frais de campagne.`
    tips.push('Alternez avec une légumineuse (pois chiche, fève) pour reposer le sol et limiter les engrais.')
  } else {
    const t = e.trees
    const stageText: Record<string, string> = {
      futur: 'pas encore plantés',
      jeune: `jeunes (${e.age} ans) et pas encore en production`,
      adulte: `en montée de production (${e.age} ans)`,
      mature: `en pleine production (${e.age} ans)`,
      declin: `âgés (${e.age} ans), leur rendement diminue`,
    }
    summary =
      `Votre terrain de ${nf(ha, 2)} ha peut accueillir environ ${nf(t.count)} ${s.name.toLowerCase()}s ` +
      `(${e.inputs.rowSpacingM} × ${e.inputs.treeSpacingM} m). Les arbres sont ${stageText[e.stage ?? 'futur']}. `
    if (e.production.kgPerYear > 0) {
      summary += `Comptez environ ${tonnes(e.production.kgPerYear)} par an, soit ${nf(e.economics.revenuePerYear)} € au prix de ${nf(e.economics.pricePerKg, 2)} €/kg. `
    } else {
      const first = e.projection.find((p) => p.kg > 0)
      summary += first
        ? `La première récolte est attendue vers ${first.year}, et la pleine production atteindra ${tonnes(e.production.kgPerYearFull)} par an. `
        : `La pleine production pourra atteindre ${tonnes(e.production.kgPerYearFull)} par an. `
    }
    if (e.water.irrigationM3PerYear > 0) summary += `L'irrigation ${IRRIGATION_LABEL[e.inputs.irrigation]} demandera environ ${nf(e.water.irrigationM3PerYear)} m³ d'eau cette année.`

    // Espacement très différent de la recommandation
    const rec = (s.rowSpacingM ?? 0) * (s.treeSpacingM ?? 0)
    const used = (e.inputs.rowSpacingM ?? 0) * (e.inputs.treeSpacingM ?? 0)
    if (rec > 0 && used < rec * 0.7) {
      tips.push(`Plantation dense : ${nf(t.densityPerHa)} arbres/ha. Elle produit plus vite, mais demande plus d'eau et une taille rigoureuse.`)
    } else if (rec > 0 && used > rec * 1.4) {
      tips.push(`Espacement large : vous pourriez planter jusqu'à ${nf(Math.round((t.count * used) / rec))} arbres en suivant l'espacement recommandé.`)
    }
    if (e.stage === 'jeune' || e.stage === 'futur') tips.push('Les 3 premières années, protégez les jeunes plants du vent et du soleil, et faites une taille de formation.')
    if (e.stage === 'mature') tips.push("Une taille d'entretien chaque hiver maintient la production et aère le feuillage.")
    if (e.stage === 'declin') tips.push('Envisagez un renouvellement progressif du verger (10 à 15 % des arbres par an).')
    if (e.economics.paybackYears) tips.push(`L'investissement de départ (${nf(e.economics.installationCost)} €) est remboursé environ ${e.economics.paybackYears} ans après la plantation.`)
  }

  tips.push(e.water.advice)
  if (e.co2.kgPerYear > 0) {
    tips.push(`Votre parcelle absorbe environ ${tonnes(e.co2.kgPerYear)} de CO2 par an, l'équivalent de ${nf(e.co2.kgPerYear / 0.12)} km parcourus en voiture.`)
  }

  // Confiance : baisse quand l'estimation repose sur plus d'hypothèses
  let confidence = 0.82
  if (e.stage === 'futur' || e.age === 0) confidence -= 0.1
  if (e.inputs.irrigation === 'pluvial') confidence -= 0.08
  if (ha < 0.2) confidence -= 0.05
  if (e.trees?.method === 'surface') confidence -= 0.05

  return { summary, tips: tips.slice(0, 5), confidence: Math.max(0.4, Math.min(0.9, Math.round(confidence * 100) / 100)), source: 'mock' }
}
