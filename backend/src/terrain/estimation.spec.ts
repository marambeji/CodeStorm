import type { Polygon } from 'geojson'
import {
  netNeedMm, estimate, growthStage, InvalidPolygonError, measurePolygon, plantingGrid, validatePolygon, yieldFactor, type SpeciesRef } from './estimation.js'
import { SPECIES } from './species.data.js'

/** Convertit une donnée du seed en SpeciesRef (champs absents → null, comme Prisma) */
function ref(id: string): SpeciesRef {
  const s = SPECIES.find((x) => x.id === id)!
  const nullable = <T>(v: T | undefined) => (v === undefined ? null : v)
  return {
    id: s.id,
    name: s.name,
    kind: s.kind,
    droughtTolerance: s.droughtTolerance,
    rowSpacingM: nullable(s.rowSpacingM),
    treeSpacingM: nullable(s.treeSpacingM),
    waterM3PerTreeYear: nullable(s.waterM3PerTreeYear),
    firstProductionAge: nullable(s.firstProductionAge),
    fullProductionAge: nullable(s.fullProductionAge),
    fullYieldKgPerTree: nullable(s.fullYieldKgPerTree),
    lifespanYears: nullable(s.lifespanYears),
    plantCostEur: nullable(s.plantCostEur),
    maintenanceEurPerTreeYr: nullable(s.maintenanceEurPerTreeYr),
    co2KgPerTreeYear: nullable(s.co2KgPerTreeYear),
    yieldKgPerHa: nullable(s.yieldKgPerHa),
    waterM3PerHaYear: nullable(s.waterM3PerHaYear),
    costEurPerHa: nullable(s.costEurPerHa),
    co2KgPerHaYear: nullable(s.co2KgPerHaYear),
    pricePerKgEur: s.pricePerKgEur,
  }
}

/** Carré d'environ `side` mètres de côté, centré près de Sfax (Tunisie) */
function square(side: number, lat = 34.75, lng = 10.6): Polygon {
  const dLat = side / 110_574
  const dLng = side / (111_320 * Math.cos((lat * Math.PI) / 180))
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng, lat],
        [lng + dLng, lat],
        [lng + dLng, lat + dLat],
        [lng, lat + dLat],
        [lng, lat],
      ],
    ],
  }
}

describe('géométrie', () => {
  it('mesure un carré de 100 m : ~1 ha et ~400 m de périmètre', () => {
    const m = measurePolygon(square(100))
    expect(m.areaHa).toBeCloseTo(1, 1)
    expect(m.perimeterM).toBeGreaterThan(395)
    expect(m.perimeterM).toBeLessThan(405)
    expect(m.vertexCount).toBe(4)
  })

  it('ferme automatiquement un anneau ouvert', () => {
    const p = square(100)
    p.coordinates[0].pop()
    expect(validatePolygon(p).coordinates[0]).toHaveLength(5)
  })

  it('refuse un contour qui se croise (nœud papillon)', () => {
    const bowtie: Polygon = {
      type: 'Polygon',
      coordinates: [[[10, 34], [10.01, 34.01], [10.01, 34], [10, 34.01], [10, 34]]],
    }
    expect(() => validatePolygon(bowtie)).toThrow(InvalidPolygonError)
  })

  it('refuse un terrain minuscule et des coordonnées impossibles', () => {
    expect(() => validatePolygon(square(3))).toThrow(/trop petit/)
    expect(() => validatePolygon({ type: 'Polygon', coordinates: [[[200, 0], [1, 1], [2, 2], [200, 0]]] })).toThrow(InvalidPolygonError)
    expect(() => validatePolygon({ type: 'Point', coordinates: [0, 0] })).toThrow(InvalidPolygonError)
  })
})

describe('grille de plantation', () => {
  it('place ~ surface / (rang × arbre) arbres', () => {
    // 1 ha en 7 × 5 m → 10 000 / 35 ≈ 285 arbres (±10 % selon les bords)
    const g = plantingGrid(square(100), 7, 5)
    expect(g.count).toBeGreaterThan(256)
    expect(g.count).toBeLessThan(314)
    expect(g.points).toHaveLength(g.count)
    expect(g.truncated).toBe(false)
  })

  it("au-delà de la limite d'aperçu, simplifie la grille sur TOUT le terrain sans changer le nombre", () => {
    const exact = plantingGrid(square(400), 7, 5, 1_000_000) // ~4 570 arbres, sans limite
    const g = plantingGrid(square(400), 7, 5, 1000)
    expect(g.count).toBe(exact.count)
    expect(g.truncated).toBe(true)
    expect(g.points.length).toBeLessThanOrEqual(1000)
    expect(g.previewScale).toBeGreaterThan(1)
    // L'aperçu couvre bien le nord ET le sud du terrain (pas de rangs coupés)
    const lats = g.points.map((p) => p[0])
    const exactLats = exact.points.map((p) => p[0])
    expect(Math.max(...lats)).toBeGreaterThan(Math.max(...exactLats) - 0.0004)
    expect(Math.min(...lats)).toBeLessThan(Math.min(...exactLats) + 0.0004)
  })

  it('bascule sur une estimation par surface pour un très grand terrain', () => {
    const g = plantingGrid(square(5000), 2.5, 1.2) // 2 500 ha de vigne
    expect(g.method).toBe('surface')
    // Surface réelle (Turf, géodésique) / 3 m² par pied, à 1 % près
    expect(Math.abs(g.count / (25_000_000 / 3) - 1)).toBeLessThan(0.01)
  })
})

describe('courbe de rendement', () => {
  const olive = ref('olivier')
  it('0 avant la première récolte, 100 % en pleine production, déclin en fin de vie', () => {
    expect(yieldFactor(2, olive)).toBe(0)
    expect(yieldFactor(4, olive)).toBeCloseTo(0.1)
    expect(yieldFactor(7, olive)).toBeGreaterThan(0.1)
    expect(yieldFactor(7, olive)).toBeLessThan(1)
    expect(yieldFactor(20, olive)).toBe(1)
    expect(yieldFactor(95, olive)).toBeLessThan(1)
  })
  it("donne le bon stade de croissance", () => {
    expect(growthStage(-1, olive)).toBe('futur')
    expect(growthStage(2, olive)).toBe('jeune')
    expect(growthStage(6, olive)).toBe('adulte')
    expect(growthStage(30, olive)).toBe('mature')
  })
})

describe('estimation complète', () => {
  it('oliveraie adulte de 1 ha en goutte-à-goutte : chiffres cohérents', () => {
    const e = estimate({ polygon: square(100), species: ref('olivier'), plantingYear: 2010, irrigation: 'goutte-a-goutte', currentYear: 2026 })
    const trees = e.trees!.count
    expect(e.stage).toBe('mature')
    // Pleine production : 20 kg / arbre
    expect(e.production.kgPerYear).toBe(trees * 20)
    // Eau : 8 m³ / arbre adulte, divisés par l'efficience 0,9
    expect(e.water.needM3PerYear).toBe(trees * 8)
    expect(e.water.irrigationM3PerYear).toBeCloseTo((trees * 8) / 0.9, -1)
    expect(e.economics.revenuePerYear).toBe(Math.round(trees * 20 * 0.8))
    expect(e.projection).toHaveLength(10)
    expect(e.projection[0].year).toBe(2026)
    expect(e.economics.paybackYears).toBeGreaterThan(4)
  })

  it('terrain vide : production nulle cette année, puis croissance sur 10 ans', () => {
    const e = estimate({ polygon: square(100), species: ref('amandier'), plantingYear: null, irrigation: 'goutte-a-goutte', currentYear: 2026 })
    expect(e.age).toBe(0)
    expect(e.production.kgPerYear).toBe(0)
    expect(e.projection[9].kg).toBeGreaterThan(e.projection[3].kg)
  })

  it('le pluvial réduit le rendement et annule l’irrigation', () => {
    const irrigated = estimate({ polygon: square(100), species: ref('figuier'), plantingYear: 2015, irrigation: 'goutte-a-goutte', currentYear: 2026 })
    const rainfed = estimate({ polygon: square(100), species: ref('figuier'), plantingYear: 2015, irrigation: 'pluvial', currentYear: 2026 })
    expect(rainfed.production.kgPerYear).toBeCloseTo(irrigated.production.kgPerYear * 0.6, -1)
    expect(rainfed.water.irrigationM3PerYear).toBe(0)
  })

  it('le prix saisi par l’utilisateur remplace le prix de référence', () => {
    const e = estimate({ polygon: square(100), species: ref('olivier'), plantingYear: 2010, irrigation: 'goutte-a-goutte', pricePerKg: 1.5, currentYear: 2026 })
    expect(e.economics.pricePerKg).toBe(1.5)
    expect(e.economics.revenuePerYear).toBe(Math.round(e.production.kgPerYear * 1.5))
  })

  it('culture annuelle (blé) : calcul à l’hectare, sans arbres', () => {
    const e = estimate({ polygon: square(100), species: ref('ble'), plantingYear: null, irrigation: 'aspersion', currentYear: 2026 })
    expect(e.trees).toBeNull()
    expect(e.production.kgPerYear).toBeCloseTo(5000, -2)
    expect(e.water.needM3PerYear).toBeCloseTo(4500, -2)
  })
})

describe('eau selon le climat réel (FAO-56)', () => {
  // Climat type Sfax : ET0 ≈ 1 290 mm/an, pluie ≈ 210 mm/an
  const et0 = [60, 70, 100, 130, 160, 180, 200, 190, 140, 100, 70, 55]
  const rain = [30, 25, 30, 20, 10, 2, 0, 5, 30, 35, 20, 3]
  const climate = { source: 'open-meteo' as const, from: '2025-11-01', to: '2026-10-31', et0Mm: 1305, rainMm: 210, monthly: et0.map((e, i) => ({ month: `m${i}`, et0: e, rain: rain[i] })) }

  it('besoin net = Σ max(0, ET0 × Kc − pluie efficace)', () => {
    // en été la pluie efficace est nulle : juillet = 200 × 0,5
    expect(netNeedMm({ ...climate, monthly: [climate.monthly[6]] }, 0.5)).toBeCloseTo(100)
    expect(netNeedMm(climate, 0.49)).toBeGreaterThan(500)
  })

  it('un climat plus sec demande plus d’eau qu’un climat humide', () => {
    const wet = { ...climate, monthly: climate.monthly.map((m) => ({ ...m, rain: m.rain + 80 })) }
    expect(netNeedMm(wet, 0.49)).toBeLessThan(netNeedMm(climate, 0.49))
  })
})
