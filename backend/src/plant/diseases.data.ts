/**
 * Base de connaissances PlantDoc.
 *
 * Les classes reprennent celles du jeu de données PlantVillage (cultures et maladies),
 * sur lequel le modèle MobileNet du navigateur est (ou sera) entraîné : quand le vrai
 * modèle est branché, ses étiquettes correspondent directement à ces clés.
 *
 * Les traitements sont des recommandations générales en langage simple ;
 * l'application rappelle de toujours respecter l'étiquette des produits.
 */
export interface DiseaseInfo {
  key: string
  crop: string
  name: string
  healthy: boolean
  agent: 'champignon' | 'bactérie' | 'virus' | 'aucun'
  symptoms: string
  treatment: string
  organic: string
  prevention: string
  contagious: boolean
}

export const CROPS: { id: string; name: string }[] = [
  { id: 'tomate', name: 'Tomate' },
  { id: 'pomme-de-terre', name: 'Pomme de terre' },
  { id: 'vigne', name: 'Vigne' },
  { id: 'pommier', name: 'Pommier' },
  { id: 'poivron', name: 'Poivron' },
  { id: 'mais', name: 'Maïs' },
]

const healthy = (crop: string, cropName: string): DiseaseInfo => ({
  key: `${crop}-sain`,
  crop,
  name: 'Plante saine',
  healthy: true,
  agent: 'aucun',
  symptoms: `Feuillage de ${cropName.toLowerCase()} homogène, sans tache ni déformation.`,
  treatment: 'Aucun traitement nécessaire.',
  organic: 'Continuez les bonnes pratiques : arrosage au pied, paillage, rotation des cultures.',
  prevention: 'Surveillez les feuilles chaque semaine, surtout après une période chaude et humide.',
  contagious: false,
})

export const DISEASES: DiseaseInfo[] = [
  // ── Tomate ──
  healthy('tomate', 'Tomate'),
  {
    key: 'tomate-mildiou',
    crop: 'tomate',
    name: 'Mildiou de la tomate',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches brunes huileuses sur les feuilles, duvet blanc au revers par temps humide, fruits qui brunissent.',
    treatment: 'Retirez et détruisez les feuilles atteintes, puis traitez avec un fongicide homologué contre le mildiou (cuivre ou anti-mildiou systémique).',
    organic: 'Bouillie bordelaise à faible dose, en respectant le délai avant récolte.',
    prevention: "Arrosez au pied, jamais sur le feuillage ; espacez les plants pour aérer ; évitez de planter après des pommes de terre.",
    contagious: true,
  },
  {
    key: 'tomate-alternariose',
    crop: 'tomate',
    name: 'Alternariose',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches brunes en cercles concentriques (en "cible") sur les feuilles du bas, qui jaunissent.',
    treatment: 'Supprimez les feuilles basses atteintes et appliquez un fongicide homologué.',
    organic: 'Purin de prêle en prévention, bouillie bordelaise en traitement.',
    prevention: 'Paillez le sol pour éviter les éclaboussures et faites une rotation sur 3 ans.',
    contagious: true,
  },
  {
    key: 'tomate-septoriose',
    crop: 'tomate',
    name: 'Septoriose',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Nombreuses petites taches rondes à centre gris et bord brun sur les feuilles basses.',
    treatment: 'Éliminez les feuilles touchées et traitez avec un fongicide à base de cuivre.',
    organic: 'Bouillie bordelaise et paillage.',
    prevention: 'Évitez de mouiller le feuillage et nettoyez les débris de culture en fin de saison.',
    contagious: true,
  },
  {
    key: 'tomate-cladosporiose',
    crop: 'tomate',
    name: 'Cladosporiose',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches jaune pâle sur le dessus des feuilles, feutrage olive au revers. Fréquent sous serre.',
    treatment: 'Aérez la serre, retirez les feuilles atteintes et appliquez un fongicide adapté.',
    organic: 'Aération maximale et bicarbonate de potassium.',
    prevention: "Réduisez l'humidité sous abri et choisissez des variétés résistantes.",
    contagious: true,
  },
  {
    key: 'tomate-tache-bacterienne',
    crop: 'tomate',
    name: 'Tache bactérienne',
    healthy: false,
    agent: 'bactérie',
    symptoms: 'Petites taches noires entourées d’un halo jaune sur feuilles et fruits.',
    treatment: 'Retirez les organes atteints ; un traitement au cuivre limite la propagation.',
    organic: 'Cuivre à faible dose et désinfection des outils.',
    prevention: 'Utilisez des semences saines et évitez de travailler sur feuillage mouillé.',
    contagious: true,
  },
  {
    key: 'tomate-tylcv',
    crop: 'tomate',
    name: 'Virus des feuilles jaunes en cuillère',
    healthy: false,
    agent: 'virus',
    symptoms: 'Feuilles jaunes, petites et enroulées vers le haut, plant rabougri.',
    treatment: "Aucun traitement curatif : arrachez les plants atteints et luttez contre l'aleurode (mouche blanche) qui transmet le virus.",
    organic: 'Filets anti-insectes et pièges jaunes contre les aleurodes.',
    prevention: 'Variétés résistantes, filets insect-proof sous serre.',
    contagious: true,
  },
  // ── Pomme de terre ──
  healthy('pomme-de-terre', 'Pomme de terre'),
  {
    key: 'pomme-de-terre-mildiou',
    crop: 'pomme-de-terre',
    name: 'Mildiou de la pomme de terre',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches brunes à contour clair, feutrage blanc au revers, flétrissement rapide du feuillage.',
    treatment: 'Traitez rapidement avec un anti-mildiou homologué ; détruisez les fanes très atteintes avant la récolte.',
    organic: 'Bouillie bordelaise en préventif, tous les 10 à 14 jours par temps humide.',
    prevention: 'Buttez les plants, utilisez des tubercules sains et surveillez les alertes météo.',
    contagious: true,
  },
  {
    key: 'pomme-de-terre-alternariose',
    crop: 'pomme-de-terre',
    name: 'Alternariose',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches brunes anguleuses avec cercles concentriques sur les feuilles âgées.',
    treatment: 'Fongicide homologué dès les premières taches.',
    organic: 'Fertilisation équilibrée et bouillie bordelaise.',
    prevention: 'Rotation des cultures et irrigation régulière (le stress hydrique favorise la maladie).',
    contagious: true,
  },
  // ── Vigne ──
  healthy('vigne', 'Vigne'),
  {
    key: 'vigne-black-rot',
    crop: 'vigne',
    name: 'Black-rot',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches brun-rouge bordées de noir sur les feuilles, baies qui se dessèchent et noircissent.',
    treatment: 'Retirez les grappes momifiées et appliquez un fongicide homologué contre le black-rot.',
    organic: 'Cuivre et soufre en prévention, élimination des momies.',
    prevention: 'Taille aérée et ramassage des baies desséchées en hiver.',
    contagious: true,
  },
  {
    key: 'vigne-esca',
    crop: 'vigne',
    name: 'Esca',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Feuilles "tigrées" (jaunes ou rouges entre les nervures), dessèchement brutal du cep.',
    treatment: 'Pas de traitement curatif homologué : marquez les ceps, curetez ou recépez les ceps atteints.',
    organic: 'Taille douce respectant les flux de sève.',
    prevention: 'Taillez par temps sec et protégez les grosses plaies de taille.',
    contagious: false,
  },
  {
    key: 'vigne-isariopsis',
    crop: 'vigne',
    name: 'Isariopsis (brûlure des feuilles)',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches brunes irrégulières qui s’étendent, défoliation précoce.',
    treatment: 'Fongicide homologué et suppression des feuilles atteintes.',
    organic: 'Cuivre en prévention.',
    prevention: 'Aérez la végétation par l’effeuillage.',
    contagious: true,
  },
  // ── Pommier ──
  healthy('pommier', 'Pommier'),
  {
    key: 'pommier-tavelure',
    crop: 'pommier',
    name: 'Tavelure',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches olive à noires veloutées sur les feuilles, fruits crevassés.',
    treatment: 'Fongicide homologué au printemps, lors des pluies contaminantes.',
    organic: 'Soufre ou cuivre, ramassage des feuilles tombées.',
    prevention: 'Broyez les feuilles mortes en automne et choisissez des variétés résistantes.',
    contagious: true,
  },
  {
    key: 'pommier-pourriture-noire',
    crop: 'pommier',
    name: 'Pourriture noire',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches violacées sur les feuilles, chancres sur les branches, fruits qui pourrissent.',
    treatment: 'Coupez les branches chancreuses et retirez les fruits momifiés.',
    organic: 'Taille sanitaire et cuivre.',
    prevention: 'Évitez les blessures et nettoyez le verger.',
    contagious: true,
  },
  {
    key: 'pommier-rouille',
    crop: 'pommier',
    name: 'Rouille du pommier',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches orange vif sur les feuilles, avec de petites pustules au revers.',
    treatment: 'Fongicide homologué au printemps.',
    organic: 'Éloignez les genévriers, hôtes du champignon.',
    prevention: 'Variétés tolérantes.',
    contagious: true,
  },
  // ── Poivron ──
  healthy('poivron', 'Poivron'),
  {
    key: 'poivron-tache-bacterienne',
    crop: 'poivron',
    name: 'Tache bactérienne',
    healthy: false,
    agent: 'bactérie',
    symptoms: 'Taches noires gorgées d’eau sur les feuilles, qui jaunissent et tombent.',
    treatment: 'Retirez les feuilles atteintes ; un traitement cuprique limite la propagation.',
    organic: 'Cuivre et rotation.',
    prevention: 'Semences certifiées et arrosage au pied.',
    contagious: true,
  },
  // ── Maïs ──
  healthy('mais', 'Maïs'),
  {
    key: 'mais-rouille',
    crop: 'mais',
    name: 'Rouille commune',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Petites pustules brun-rouge poudreuses sur les deux faces des feuilles.',
    treatment: 'Rarement nécessaire ; fongicide si l’attaque est précoce et forte.',
    organic: 'Variétés résistantes.',
    prevention: 'Semis à la bonne date et variétés tolérantes.',
    contagious: true,
  },
  {
    key: 'mais-helminthosporiose',
    crop: 'mais',
    name: 'Helminthosporiose',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Longues taches grises en forme de cigare sur les feuilles.',
    treatment: 'Fongicide homologué si la maladie atteint les feuilles hautes avant la floraison.',
    organic: 'Enfouissement des résidus.',
    prevention: 'Rotation et labour des résidus de culture.',
    contagious: true,
  },
  {
    key: 'mais-cercosporiose',
    crop: 'mais',
    name: 'Cercosporiose',
    healthy: false,
    agent: 'champignon',
    symptoms: 'Taches rectangulaires grises limitées par les nervures.',
    treatment: 'Fongicide homologué en cas de forte pression.',
    organic: 'Rotation longue.',
    prevention: 'Évitez la monoculture de maïs.',
    contagious: true,
  },
]

/**
 * Gravité calculée par le code à partir de la part de feuille atteinte
 * (estimée par l'analyse d'image) : pas d'avis du LLM ici.
 */
export function severityFromRatio(healthy: boolean, affectedRatio: number): 'aucune' | 'faible' | 'moyenne' | 'élevée' {
  if (healthy) return 'aucune'
  if (affectedRatio < 0.05) return 'faible'
  if (affectedRatio < 0.2) return 'moyenne'
  return 'élevée'
}
