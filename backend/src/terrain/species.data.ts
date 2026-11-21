/**
 * Données agronomiques de référence pour TerraCalc (insérées par le seed).
 *
 * ⚠️ Ce sont des ORDRES DE GRANDEUR moyens pour une conduite irriguée en climat
 * méditerranéen / semi-aride. Ils varient fortement selon la variété, le sol, le climat
 * et la conduite. L'application les présente toujours comme "estimation indicative",
 * et l'utilisateur peut modifier le prix de vente.
 */
export interface SpeciesSeed {
  id: string
  name: string
  kind: 'tree' | 'crop'
  description: string
  climate: string
  droughtTolerance: 'faible' | 'moyenne' | 'élevée'
  rowSpacingM?: number
  treeSpacingM?: number
  waterM3PerTreeYear?: number
  firstProductionAge?: number
  fullProductionAge?: number
  fullYieldKgPerTree?: number
  lifespanYears?: number
  plantCostEur?: number
  maintenanceEurPerTreeYr?: number
  co2KgPerTreeYear?: number
  yieldKgPerHa?: number
  waterM3PerHaYear?: number
  costEurPerHa?: number
  co2KgPerHaYear?: number
  pricePerKgEur: number
}

export const SPECIES: SpeciesSeed[] = [
  {
    id: 'olivier',
    name: 'Olivier',
    kind: 'tree',
    description: "Arbre rustique et très longévif, pilier de l'agriculture méditerranéenne. Olives de table ou à huile.",
    climate: 'Méditerranéen, semi-aride',
    droughtTolerance: 'élevée',
    rowSpacingM: 7,
    treeSpacingM: 5,
    waterM3PerTreeYear: 8,
    firstProductionAge: 4,
    fullProductionAge: 10,
    fullYieldKgPerTree: 20, // oliveraie irriguée de densité moyenne (≈ 5 t/ha)
    lifespanYears: 100,
    plantCostEur: 8,
    maintenanceEurPerTreeYr: 6,
    co2KgPerTreeYear: 25,
    pricePerKgEur: 0.8,
  },
  {
    id: 'palmier-dattier',
    name: 'Palmier dattier',
    kind: 'tree',
    description: "L'arbre des oasis. Supporte la chaleur extrême mais a besoin de beaucoup d'eau au pied.",
    climate: 'Saharien, chaud et sec',
    droughtTolerance: 'moyenne',
    rowSpacingM: 8,
    treeSpacingM: 8,
    waterM3PerTreeYear: 20,
    firstProductionAge: 5,
    fullProductionAge: 12,
    fullYieldKgPerTree: 60,
    lifespanYears: 80,
    plantCostEur: 35,
    maintenanceEurPerTreeYr: 15,
    co2KgPerTreeYear: 40,
    pricePerKgEur: 3,
  },
  {
    id: 'amandier',
    name: 'Amandier',
    kind: 'tree',
    description: 'Floraison précoce, bonne valorisation des amandes. Sensible aux gelées de printemps.',
    climate: 'Méditerranéen, hivers doux',
    droughtTolerance: 'élevée',
    rowSpacingM: 7,
    treeSpacingM: 6,
    waterM3PerTreeYear: 6,
    firstProductionAge: 3,
    fullProductionAge: 7,
    fullYieldKgPerTree: 10,
    lifespanYears: 50,
    plantCostEur: 6,
    maintenanceEurPerTreeYr: 8,
    co2KgPerTreeYear: 20,
    pricePerKgEur: 5,
  },
  {
    id: 'agrumes',
    name: 'Agrumes',
    kind: 'tree',
    description: 'Orangers, mandariniers, citronniers. Production abondante, mais exigeants en eau régulière.',
    climate: 'Méditerranéen, sans gel',
    droughtTolerance: 'faible',
    rowSpacingM: 6,
    treeSpacingM: 4,
    waterM3PerTreeYear: 7,
    firstProductionAge: 3,
    fullProductionAge: 8,
    fullYieldKgPerTree: 60,
    lifespanYears: 50,
    plantCostEur: 10,
    maintenanceEurPerTreeYr: 10,
    co2KgPerTreeYear: 22,
    pricePerKgEur: 0.6,
  },
  {
    id: 'grenadier',
    name: 'Grenadier',
    kind: 'tree',
    description: 'Petit arbre résistant à la chaleur et aux sols salins. Fruits très recherchés.',
    climate: 'Méditerranéen à semi-aride',
    droughtTolerance: 'élevée',
    rowSpacingM: 5,
    treeSpacingM: 3,
    waterM3PerTreeYear: 5,
    firstProductionAge: 2,
    fullProductionAge: 6,
    fullYieldKgPerTree: 25,
    lifespanYears: 40,
    plantCostEur: 5,
    maintenanceEurPerTreeYr: 6,
    co2KgPerTreeYear: 12,
    pricePerKgEur: 1.2,
  },
  {
    id: 'figuier',
    name: 'Figuier',
    kind: 'tree',
    description: 'Très rustique, peu exigeant. Figues fraîches ou séchées, deux récoltes possibles par an.',
    climate: 'Méditerranéen, chaud',
    droughtTolerance: 'élevée',
    rowSpacingM: 6,
    treeSpacingM: 5,
    waterM3PerTreeYear: 4,
    firstProductionAge: 2,
    fullProductionAge: 6,
    fullYieldKgPerTree: 20,
    lifespanYears: 60,
    plantCostEur: 6,
    maintenanceEurPerTreeYr: 6,
    co2KgPerTreeYear: 15,
    pricePerKgEur: 2,
  },
  {
    id: 'vigne',
    name: 'Vigne',
    kind: 'tree',
    description: 'Conduite en rangs palissés. Raisin de table ou de cuve, forte densité de pieds.',
    climate: 'Méditerranéen à tempéré',
    droughtTolerance: 'moyenne',
    rowSpacingM: 2.5,
    treeSpacingM: 1.2,
    waterM3PerTreeYear: 0.8,
    firstProductionAge: 3,
    fullProductionAge: 5,
    fullYieldKgPerTree: 4,
    lifespanYears: 40,
    plantCostEur: 2,
    maintenanceEurPerTreeYr: 1.5,
    co2KgPerTreeYear: 3,
    pricePerKgEur: 0.7,
  },
  {
    id: 'ble',
    name: 'Blé',
    kind: 'crop',
    description: "Céréale annuelle semée à l'automne, récoltée en été. Peut être conduite en pluvial.",
    climate: 'Méditerranéen à tempéré',
    droughtTolerance: 'moyenne',
    yieldKgPerHa: 5000,
    waterM3PerHaYear: 4500,
    costEurPerHa: 900,
    co2KgPerHaYear: 1200,
    pricePerKgEur: 0.28,
  },
]
