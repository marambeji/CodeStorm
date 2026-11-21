import { forecast, SimulatedHydroProvider, stressIndex, stressLevel, zonesCollection } from './hydro.engine.js'

describe('indice de stress hydrique', () => {
  it('est faible pour une végétation vigoureuse et humide, élevé pour un sol nu et sec', () => {
    expect(stressIndex({ ndvi: 0.75, ndwi: 0.35, rainfallAnomaly: 5 })).toBeLessThan(0.1)
    expect(stressIndex({ ndvi: 0.1, ndwi: -0.3, rainfallAnomaly: -60 })).toBeCloseTo(1, 2)
  })
  it('classe en 4 niveaux', () => {
    expect(stressLevel(0.1)).toBe('faible')
    expect(stressLevel(0.4)).toBe('modéré')
    expect(stressLevel(0.6)).toBe('élevé')
    expect(stressLevel(0.8)).toBe('critique')
  })
})

describe('prévision', () => {
  const history = Array.from({ length: 60 }, (_, i) => ({ date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10), stress: 0.3 + i * 0.004 }))

  it('prolonge une tendance à la hausse et élargit l’incertitude avec le temps', () => {
    const f = forecast(history, 30)
    expect(f.points).toHaveLength(30)
    expect(f.trend).toBe('hausse')
    expect(f.points[29].stress).toBeGreaterThan(f.points[0].stress)
    const width = (p: { low: number; high: number }) => p.high - p.low
    expect(width(f.points[29])).toBeGreaterThanOrEqual(width(f.points[0]))
    expect(f.points[0].date).toBe('2026-10-31')
  })

  it('reste toujours entre 0 et 1', () => {
    const f = forecast(history.map((p) => ({ ...p, stress: 0.98 })), 30)
    expect(Math.max(...f.points.map((p) => p.high))).toBeLessThanOrEqual(1)
  })
})

describe('données simulées', () => {
  it('fournit 15 zones reproductibles avec un niveau de stress', () => {
    const a = zonesCollection(new SimulatedHydroProvider())
    const b = zonesCollection(new SimulatedHydroProvider())
    expect(a.features).toHaveLength(15)
    expect(a).toEqual(b)
    expect(new Set(a.features.map((f) => f.properties.level)).size).toBeGreaterThan(1)
  })
})
