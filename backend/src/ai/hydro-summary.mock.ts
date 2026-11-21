import type { StressLevel, ZoneProps } from '../hydro/hydro.engine.js'

const pct = (n: number) => `${Math.round(n * 100)} %`

/**
 * Synthèses HydroMap simulées, rédigées pour des décideurs (élus, gestionnaires de l'eau).
 * Les chiffres viennent du moteur (indices, stress, prévision) : rien n'est inventé.
 */
export function mockZoneSummary(z: ZoneProps & { stress: number; level: StressLevel }, f: { trend: string; slopePerMonth: number; in30: number }) {
  const trendText =
    f.trend === 'hausse'
      ? `le stress devrait encore augmenter et atteindre environ ${pct(f.in30)} dans 30 jours`
      : f.trend === 'baisse'
        ? `le stress devrait diminuer, autour de ${pct(f.in30)} dans 30 jours`
        : `la situation devrait rester stable (environ ${pct(f.in30)} dans 30 jours)`
  const actions: Record<StressLevel, string[]> = {
    faible: ['Maintenir le suivi mensuel.', 'Encourager le stockage des eaux de pluie pour la saison sèche.'],
    modéré: ['Renforcer le suivi des puits (relevé toutes les deux semaines).', 'Sensibiliser les exploitants à l’irrigation au goutte-à-goutte.'],
    élevé: [
      'Prioriser l’eau pour les cultures pérennes (oliviers, arbres fruitiers).',
      'Instaurer des tours d’eau entre exploitants.',
      'Vérifier les forages non déclarés.',
    ],
    critique: [
      'Déclencher le plan sécheresse local : restrictions des usages non essentiels.',
      'Mobiliser l’aide d’urgence pour l’abreuvement du bétail.',
      'Suspendre les nouvelles autorisations de forage.',
    ],
  }
  return {
    summary:
      `${z.name} (${z.landUse.toLowerCase()}, ${new Intl.NumberFormat('fr-FR').format(z.areaHa).replace(/ /g, ' ')} ha) présente un stress hydrique ${z.level} (${pct(z.stress)}). ` +
      `La végétation est ${z.ndvi > 0.5 ? 'vigoureuse' : z.ndvi > 0.3 ? 'moyennement développée' : 'clairsemée'} (NDVI ${z.ndvi.toFixed(2)}), ` +
      `les pluies sont ${z.rainfallAnomaly < 0 ? `inférieures de ${Math.abs(z.rainfallAnomaly)} %` : `supérieures de ${z.rainfallAnomaly} %`} à la normale ` +
      `et la nappe ${z.groundwaterTrend < 0 ? `baisse de ${Math.abs(z.groundwaterTrend).toFixed(1)} m par an` : 'est stable'}. Selon la prévision, ${trendText}.`,
    actions: actions[z.level],
    source: 'mock' as const,
  }
}

export function mockHydroOverview(counts: Record<StressLevel, number>, worst: { name: string; stress: number }[], total: number) {
  const atRisk = counts.élevé + counts.critique
  return {
    summary:
      `Sur ${total} zones suivies, ${atRisk} sont en stress élevé ou critique. ` +
      (worst.length ? `Les plus touchées sont ${worst.map((w) => `${w.name} (${pct(w.stress)})`).join(', ')}. ` : '') +
      (counts.critique > 0
        ? 'Une action rapide est recommandée sur les zones critiques, en priorité pour l’eau potable et les cultures pérennes.'
        : 'Aucune zone n’est critique : la priorité est la prévention avant l’été.'),
    source: 'mock' as const,
  }
}
