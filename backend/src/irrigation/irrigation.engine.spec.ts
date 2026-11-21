import { buildPlan, canopyFactor, effectiveRain, type DayWeather, type PlanInput } from './irrigation.engine.js'

const week = (et0: number, rain: number[] = []): DayWeather[] =>
  Array.from({ length: 7 }, (_, i) => ({ date: `2026-07-0${i + 1}`, et0, rain: rain[i] ?? 0, tMax: 33, tMin: 21 }))

const base: PlanInput = {
  speciesId: 'olivier',
  kind: 'tree',
  areaM2: 10_000,
  trees: 280,
  age: 15,
  fullProductionAge: 10,
  irrigation: 'goutte-a-goutte',
  pumpHeadM: 30,
  kwhPrice: 0.25,
  habitWaterM3PerYear: 8 * 280,
  weather: week(6),
}

describe('IrriPlan (FAO-56)', () => {
  it('ignore les petites pluies et compte 75 % des fortes', () => {
    expect(effectiveRain(3)).toBe(0)
    expect(effectiveRain(20)).toBe(15)
  })

  it('un jeune arbre consomme moins qu’un adulte', () => {
    expect(canopyFactor(0, 10)).toBeCloseTo(0.3)
    expect(canopyFactor(20, 10)).toBe(1)
  })

  it('été sec : irrigue quand le déficit dépasse le seuil, volume = ETc × surface / efficience', () => {
    const p = buildPlan(base)
    // ETc = 6 × 0,65 × 0,6 (goutte-à-goutte) = 2,34 mm/j ; seuil 4 mm → arrosage tous les 2 jours
    expect(p.days.filter((d) => d.irrigate).length).toBe(3)
    expect(p.totals.volumeM3).toBeCloseTo((2.34 * 6 * 10_000) / 1000 / 0.9, 0)
    expect(p.totals.kwh).toBeGreaterThan(0)
  })

  it('une forte pluie annule l’irrigation', () => {
    const p = buildPlan({ ...base, weather: week(6, [0, 30, 0, 0, 0, 0, 0]) })
    expect(p.days[1].reason).toMatch(/Pluie prévue/)
    expect(p.totals.volumeM3).toBeLessThan(buildPlan(base).totals.volumeM3)
  })

  it('économise de l’eau par rapport à un arrosage d’habitude quand il pleut', () => {
    const p = buildPlan({ ...base, weather: week(3, [12, 0, 0, 10, 0, 0, 0]) })
    expect(p.comparison.savedM3).toBeGreaterThan(0)
  })
})
