import { analyzeReadings, checkIndexConsistency, type ReadingLike } from './consumption.js'

/** Relevés hebdomadaires : index de départ + consommation en litres/jour pour chaque semaine */
function weekly(litersPerDay: number[], start = 1000): ReadingLike[] {
  let value = start
  const readings: ReadingLike[] = [{ id: 'r0', value, readAt: new Date(Date.UTC(2026, 8, 1)) }]
  litersPerDay.forEach((l, i) => {
    value += (l * 7) / 1000
    readings.push({ id: `r${i + 1}`, value, readAt: new Date(Date.UTC(2026, 8, 1 + 7 * (i + 1))) })
  })
  return readings
}

describe('consommation et fuites', () => {
  it('calcule les litres par jour entre deux relevés', () => {
    const a = analyzeReadings(weekly([300, 320]))
    expect(a.periods).toHaveLength(2)
    expect(a.periods[0].litersPerDay).toBe(300)
    expect(a.periods[1].days).toBe(7)
  })

  it('ne signale rien tant que la consommation reste habituelle', () => {
    const a = analyzeReadings(weekly([300, 320, 290, 340, 310]))
    expect(a.periods.some((p) => p.anomaly)).toBe(false)
    expect(a.stats.leakAlert).toBe(false)
  })

  it('détecte une fuite : consommation × 2,5 par rapport à l’habitude', () => {
    const a = analyzeReadings(weekly([300, 320, 290, 310, 780]))
    expect(a.stats.leakAlert).toBe(true)
    expect(a.periods.at(-1)!.baseline).toBe(305)
    expect(a.stats.excessLitersPerDay).toBe(780 - 305)
  })

  it('ignore une petite hausse en valeur absolue (moins de 150 L/j en plus)', () => {
    const a = analyzeReadings(weekly([60, 70, 65, 150])) // ×2,3 mais seulement +85 L/j
    expect(a.stats.leakAlert).toBe(false)
  })

  it('ne s’habitue pas à une fuite qui dure', () => {
    const a = analyzeReadings(weekly([300, 310, 800, 820]))
    expect(a.periods.at(-1)!.anomaly).toBe(true)
    expect(a.periods.at(-1)!.baseline).toBe(305)
  })
})

describe('cohérence des index', () => {
  const readings = weekly([300, 300])
  it('refuse un index inférieur au relevé précédent', () => {
    expect(checkIndexConsistency(readings, 999, new Date(Date.UTC(2026, 8, 20)))).toMatch(/ne peut pas diminuer/)
  })
  it('refuse un index supérieur au relevé suivant', () => {
    expect(checkIndexConsistency(readings, 1010, new Date(Date.UTC(2026, 8, 3)))).toMatch(/relevé suivant/)
  })
  it('accepte un index cohérent', () => {
    expect(checkIndexConsistency(readings, 1004.5, new Date(Date.UTC(2026, 8, 16)))).toBeNull()
  })
})
