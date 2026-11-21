/**
 * Moteur IrriPlan : planning d'irrigation sur 7 jours, SANS capteur.
 *
 * Méthode FAO-56 (référence mondiale des agronomes) :
 *   besoin de la culture ETc = ET0 (évaporation de référence, donnée météo) × Kc (coefficient de la culture)
 *   besoin net = ETc − pluie efficace
 * Le sol sert de "réservoir" : on irrigue quand le déficit cumulé dépasse un seuil
 * qui dépend du système (goutte-à-goutte : souvent et peu ; gravitaire : rarement et beaucoup).
 *
 * Tout est calculé ici ; le LLM ne fait qu'expliquer le plan.
 */
export type Irrigation = 'goutte-a-goutte' | 'aspersion' | 'gravitaire'

export interface DayWeather {
  date: string // AAAA-MM-JJ
  et0: number // mm/jour
  rain: number // mm
  tMax: number
  tMin: number
}

export interface PlanInput {
  speciesId: string
  kind: 'tree' | 'crop'
  areaM2: number
  trees: number | null
  age: number | null // âge des arbres (null = culture annuelle / inconnu)
  fullProductionAge: number | null
  irrigation: Irrigation
  pumpHeadM: number
  kwhPrice: number
  /** Consommation "d'habitude" de la culture (m³/arbre/an ou m³/ha/an), pour comparer */
  habitWaterM3PerYear: number
  weather: DayWeather[]
}

/** Coefficients culturaux Kc en pleine maturité (FAO-56, valeurs moyennes d'été) */
export const KC: Record<string, number> = {
  olivier: 0.65,
  'palmier-dattier': 0.9,
  amandier: 0.9,
  agrumes: 0.65,
  grenadier: 0.7,
  figuier: 0.7,
  vigne: 0.7,
  ble: 1.05,
}

export const IRRIGATION = {
  // kr : le goutte-à-goutte ne mouille qu'une partie du sol (facteur de réduction FAO-56 pour l'irrigation localisée)
  'goutte-a-goutte': { efficiency: 0.9, thresholdMm: 4, kr: 0.6, label: 'Goutte-à-goutte' },
  aspersion: { efficiency: 0.75, thresholdMm: 15, kr: 1, label: 'Aspersion' },
  gravitaire: { efficiency: 0.6, thresholdMm: 30, kr: 1, label: 'Gravitaire' },
} as const

const DRIP_LITERS_PER_HOUR_PER_TREE = 16 // 4 goutteurs de 4 L/h
/** Saison d'irrigation (jours/an) : l'arrosage d'habitude répartit l'eau annuelle sur cette période, sans regarder la météo */
const IRRIGATION_SEASON_DAYS = 214
const SPRINKLER_MM_PER_HOUR = 5
const PUMP_EFFICIENCY = 0.55
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

/** Pluie efficace : les petites pluies s'évaporent, les fortes ruissellent en partie */
export const effectiveRain = (mm: number) => (mm < 5 ? 0 : mm * 0.75)

/** Un jeune arbre couvre peu de sol : il consomme moins (30 % → 100 % à l'âge adulte) */
export function canopyFactor(age: number | null, fullAge: number | null) {
  if (age === null || !fullAge) return 1
  return Math.min(1, 0.3 + (0.7 * Math.max(age, 0)) / fullAge)
}

export function buildPlan(input: PlanInput) {
  const sys = IRRIGATION[input.irrigation]
  const kc = (KC[input.speciesId] ?? 0.75) * canopyFactor(input.age, input.fullProductionAge) * sys.kr
  let deficit = 0 // mm manquants dans le réservoir du sol
  const days = input.weather.map((w) => {
    const etc = w.et0 * kc
    const rainEff = effectiveRain(w.rain)
    deficit = Math.max(0, deficit + etc - rainEff)
    const irrigate = deficit >= sys.thresholdMm
    const netMm = irrigate ? deficit : 0
    if (irrigate) deficit = 0
    const grossM3 = (netMm * input.areaM2) / 1000 / sys.efficiency
    const litersPerTree = input.trees ? (grossM3 * 1000) / input.trees : null
    const durationH =
      !irrigate ? 0 : input.irrigation === 'goutte-a-goutte' && litersPerTree ? litersPerTree / DRIP_LITERS_PER_HOUR_PER_TREE : input.irrigation === 'aspersion' ? netMm / sys.efficiency / SPRINKLER_MM_PER_HOUR : null
    const kwh = (grossM3 * input.pumpHeadM * 9.81) / 3600 / PUMP_EFFICIENCY
    const reason = irrigate
      ? `Réserve du sol épuisée (${round(netMm)} mm manquants)`
      : w.rain >= 5
        ? `Pluie prévue (${round(w.rain)} mm) : inutile d'arroser`
        : `Le sol a encore assez d'eau (déficit ${round(deficit)} mm)`
    return {
      ...w,
      etc: round(etc, 2),
      rainEff: round(rainEff, 1),
      irrigate,
      netMm: round(netMm, 1),
      volumeM3: round(grossM3, 2),
      litersPerTree: litersPerTree === null ? null : round(litersPerTree, 0),
      durationH: durationH === null ? null : round(durationH, 1),
      kwh: round(kwh, 1),
      costEur: round(kwh * input.kwhPrice, 2),
      reason,
      alerts: [
        ...(w.tMax >= 35 ? ['Forte chaleur : irriguer tôt le matin ou le soir'] : []),
        ...(w.tMin <= 2 ? ['Risque de gel : ne pas irriguer le soir'] : []),
        ...(w.rain >= 15 ? ['Forte pluie : vérifier le drainage'] : []),
      ],
    }
  })

  const totalM3 = days.reduce((s, d) => s + d.volumeM3, 0)
  const totalKwh = days.reduce((s, d) => s + d.kwh, 0)
  // Arrosage "d'habitude" : la consommation annuelle moyenne répartie chaque jour, sans tenir compte de la météo
  const habitM3 = ((input.habitWaterM3PerYear / IRRIGATION_SEASON_DAYS) * days.length) / sys.efficiency
  const savedM3 = Math.max(0, habitM3 - totalM3)
  const habitKwh = (habitM3 * input.pumpHeadM * 9.81) / 3600 / PUMP_EFFICIENCY

  return {
    kc: round(kc, 2),
    efficiency: sys.efficiency,
    thresholdMm: sys.thresholdMm,
    days,
    totals: {
      volumeM3: round(totalM3, 1),
      irrigationDays: days.filter((d) => d.irrigate).length,
      kwh: round(totalKwh, 1),
      costEur: round(totalKwh * input.kwhPrice, 2),
      rainMm: round(days.reduce((s, d) => s + d.rain, 0), 1),
      et0Mm: round(days.reduce((s, d) => s + d.et0, 0), 1),
    },
    comparison: {
      habitM3: round(habitM3, 1),
      savedM3: round(savedM3, 1),
      savedPct: habitM3 > 0 ? Math.round((savedM3 / habitM3) * 100) : 0,
      savedKwh: round(Math.max(0, habitKwh - totalKwh), 1),
      savedEur: round(Math.max(0, habitKwh - totalKwh) * input.kwhPrice, 2),
    },
  }
}

export type Plan = ReturnType<typeof buildPlan>

/**
 * Météo de secours (hors connexion) : normales saisonnières d'un climat méditerranéen.
 * Le plan reste calculable ; l'interface indique que la météo est estimée.
 */
export function seasonalWeather(start: Date, days = 7): DayWeather[] {
  const et0ByMonth = [1.6, 2.2, 3.2, 4.2, 5.4, 6.4, 7.0, 6.4, 4.8, 3.3, 2.1, 1.5]
  const tMaxByMonth = [16, 17, 19, 22, 26, 31, 34, 34, 30, 26, 21, 17]
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(start.getTime() + i * 86_400_000)
    const m = d.getMonth()
    return { date: d.toISOString().slice(0, 10), et0: et0ByMonth[m], rain: 0, tMax: tMaxByMonth[m], tMin: tMaxByMonth[m] - 10 }
  })
}
