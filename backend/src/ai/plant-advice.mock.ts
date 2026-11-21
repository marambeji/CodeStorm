import type { DiseaseInfo } from '../plant/diseases.data.js'

/**
 * Conseils PlantDoc simulés (utilisés sans clé LLM).
 * Ils reformulent la base de connaissances selon la gravité : aucune information inventée.
 */
export function mockPlantAdvice(d: DiseaseInfo, severity: string, parcel: string) {
  if (d.healthy) {
    return {
      advice: `Bonne nouvelle : la feuille analysée sur « ${parcel} » ne montre aucun signe de maladie. ${d.organic}`,
      tips: [d.prevention, 'Refaites une photo si de nouvelles taches apparaissent : un diagnostic précoce évite les traitements lourds.'],
    }
  }
  const urgency =
    severity === 'élevée'
      ? 'Agissez aujourd’hui : la maladie est bien installée.'
      : severity === 'moyenne'
        ? 'Intervenez dans les 2 à 3 jours pour éviter qu’elle ne s’étende.'
        : 'La maladie débute : c’est le meilleur moment pour la stopper.'
  const tips = [
    `En bio : ${d.organic}`,
    `Pour éviter le retour : ${d.prevention}`,
    d.contagious ? 'Maladie contagieuse : inspectez les plants voisins et désinfectez vos outils.' : 'Maladie peu contagieuse entre plants.',
    'Respectez toujours la dose et le délai avant récolte indiqués sur l’étiquette du produit.',
  ]
  return { advice: `Sur « ${parcel} », la feuille présente : ${d.name.toLowerCase()}. ${urgency} ${d.treatment}`, tips }
}

/** Réponse simulée à une question posée (à l'écrit ou à la voix) sur un diagnostic */
export function mockPlantAnswer(d: DiseaseInfo, question: string) {
  const q = question.toLowerCase()
  if (/bio|naturel|écolo|ecolo/.test(q)) return `En agriculture biologique : ${d.organic}`
  if (/contag|voisin|propag|autres? plant/.test(q))
    return d.contagious
      ? 'Oui, elle peut se propager. Inspectez les plants voisins, retirez les feuilles atteintes et désinfectez vos outils.'
      : 'Elle se propage peu d’un plant à l’autre, mais surveillez quand même les plants voisins.'
  if (/quand|moment|heure|jour/.test(q)) return 'Traitez de préférence le matin ou en fin de journée, par temps sec et sans vent, et jamais juste avant une pluie.'
  if (/arros|eau|irrig/.test(q)) return 'Arrosez au pied, tôt le matin, sans mouiller les feuilles : l’humidité sur le feuillage favorise la plupart des maladies.'
  if (/récolt|recolt|manger|consomm/.test(q))
    return 'Les fruits sains restent consommables. Après un traitement, attendez le délai avant récolte indiqué sur l’étiquette du produit.'
  if (/éviter|prévent|prevent|année prochaine/.test(q)) return `Pour éviter qu’elle revienne : ${d.prevention}`
  if (/symptôme|symptome|reconna|à quoi/.test(q)) return `On la reconnaît à ces signes : ${d.symptoms}`
  return `${d.symptoms} Ce qu’il faut faire : ${d.treatment}`
}
