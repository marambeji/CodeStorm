import { describe, expect, it } from 'vitest'
import { agingRate, predictFreshness } from './freshness.js'
import { forecastSeries, recommendations, weeklyBuckets, type LotView } from './insights.js'
import { checkNextStage, checkSeal, GENESIS_PREV, hashBlock, sealOrigin, verifyChain, type Block, type BlockData } from './ledger.js'
import { optimizeRoute, pathKm } from './route.js'
import { normalizeCode } from './trace.module.js'

const DAY = 86_400_000
const T0 = new Date('2026-11-01T08:00:00Z')

function chain(code: string, stages: string[]): Block[] {
  const out: Block[] = []
  for (const [i, stage] of stages.entries()) {
    const data: BlockData = { index: i, stage, actorId: `u${i}`, actorRole: 'collecteur', actorName: `Acteur ${i}`, placeName: 'Sfax', lat: 34.7, lng: 10.7, temperature: 5, quantity: 100, note: null, prevHash: out[i - 1]?.hash ?? GENESIS_PREV, createdAt: new Date(T0.getTime() + i * DAY) }
    out.push({ ...data, hash: hashBlock(code, data) })
  }
  return out
}

describe('registre chaîné (blockchain)', () => {
  it('valide une chaîne intacte', () => {
    expect(verifyChain('LOT-AAAAAA', chain('LOT-AAAAAA', ['recolte', 'collecte', 'transport']))).toEqual({ valid: true, length: 3, brokenAt: null, reason: null })
  })

  it('détecte la modification d’un bloc', () => {
    const c = chain('LOT-AAAAAA', ['recolte', 'collecte', 'transport'])
    c[1] = { ...c[1], temperature: 25 }
    expect(verifyChain('LOT-AAAAAA', c)).toMatchObject({ valid: false, brokenAt: 1 })
  })

  it('détecte un bloc supprimé ou une chaîne recopiée sur un autre lot', () => {
    const c = chain('LOT-AAAAAA', ['recolte', 'collecte', 'transport'])
    expect(verifyChain('LOT-AAAAAA', [c[0], c[2]])).toMatchObject({ valid: false, brokenAt: 1 })
    expect(verifyChain('LOT-BBBBBB', c)).toMatchObject({ valid: false, brokenAt: 0 })
  })

  it('certifie l’origine par un sceau HMAC', () => {
    const seal = sealOrigin('secret', 'LOT-AAAAAA', 'abc', 'farmer')
    expect(checkSeal('secret', seal, 'LOT-AAAAAA', 'abc', 'farmer')).toBe(true)
    expect(checkSeal('secret', seal, 'LOT-AAAAAA', 'abc', 'autre')).toBe(false)
    expect(checkSeal('autre-secret', seal, 'LOT-AAAAAA', 'abc', 'farmer')).toBe(false)
  })

  it('impose l’ordre des étapes', () => {
    expect(checkNextStage(['recolte'], 'collecte')).toBeNull()
    expect(checkNextStage(['recolte', 'collecte', 'transport'], 'transport')).toBeNull()
    expect(checkNextStage(['recolte', 'distribution'], 'collecte')).toMatch(/plus avancée/)
    expect(checkNextStage(['recolte', 'vente'], 'transport')).toMatch(/close/)
    expect(checkNextStage(['recolte'], 'recolte')).toBe('Étape inconnue.')
  })
})

describe('prédiction de conservation', () => {
  it('à température idéale, la fraîcheur baisse linéairement', () => {
    const f = predictFreshness('legumes', T0, [{ at: T0, temperature: 4 }], new Date(T0.getTime() + 3.5 * DAY))
    expect(f.score).toBe(50)
    expect(f.remainingDays).toBe(3.5)
    expect(f.measured).toBe(true)
  })

  it('la chaleur accélère la dégradation (Q10 = 2)', () => {
    expect(agingRate(14, 4)).toBe(2)
    const f = predictFreshness('legumes', T0, [{ at: T0, temperature: 14 }], new Date(T0.getTime() + 2 * DAY))
    expect(f.consumedDays).toBe(4)
    expect(f.remainingDays).toBe(1.5) // 3 jours de vie restants consommés à vitesse ×2
    expect(f.level).toBe('a-consommer-vite')
  })

  it('signale un produit périmé', () => {
    expect(predictFreshness('fruits', T0, [], new Date(T0.getTime() + 20 * DAY))).toMatchObject({ score: 0, level: 'perime', measured: false })
  })
})

describe('prédiction de la demande', () => {
  it('suit une tendance à la hausse', () => {
    const r = forecastSeries([10, 12, 14, 16, 18, 20])
    expect(r.trend).toBe('hausse')
    expect(r.forecast).toBeGreaterThan(18)
  })

  it('ne prévoit jamais de demande négative', () => {
    expect(forecastSeries([30, 20, 10, 0, 0]).forecast).toBeGreaterThanOrEqual(0)
    expect(forecastSeries([])).toEqual({ forecast: 0, slope: 0, trend: 'stable' })
  })

  it('regroupe les ventes par semaine', () => {
    const now = new Date('2026-11-22T12:00:00Z')
    expect(weeklyBuckets([{ at: new Date(now.getTime() - DAY), quantity: 3 }, { at: new Date(now.getTime() - 8 * DAY), quantity: 2 }, { at: new Date(now.getTime() - 100 * DAY), quantity: 9 }], 4, now)).toEqual([0, 0, 2, 3])
  })
})

describe('recommandations anti-pertes', () => {
  const lot = (over: Partial<LotView>): LotView => ({
    code: 'LOT-AAAAAA',
    product: 'Tomates',
    category: 'legumes',
    quantity: 100,
    unit: 'kg',
    stage: 'transport',
    harvestDate: T0,
    lastQuantity: 100,
    blocks: [],
    freshness: predictFreshness('legumes', T0, [{ at: T0, temperature: 4 }], new Date(T0.getTime() + DAY)),
    ...over,
  })

  it('signale les pertes, la rupture du froid et les lots à écouler', () => {
    const hot = predictFreshness('legumes', T0, [{ at: T0, temperature: 25 }], new Date(T0.getTime() + DAY))
    const recos = recommendations([lot({ lastQuantity: 80, freshness: hot })], [])
    const titles = recos.map((r) => r.title).join(' | ')
    expect(titles).toMatch(/20 % de pertes/)
    expect(titles).toMatch(/Chaîne du froid/)
    expect(titles).toMatch(/Écouler/)
    expect(recos[0].severity).toBe('critique')
  })

  it('compare l’offre à la demande prévue', () => {
    const recos = recommendations([lot({ lastQuantity: 100 })], [{ category: 'legumes', history: [], forecast: 20, trend: 'stable', slope: 0 }])
    expect(recos.some((r) => r.title.startsWith('Surplus probable : légumes'))).toBe(true)
  })

  it('ignore les lots déjà vendus', () => {
    expect(recommendations([lot({ stage: 'vente', lastQuantity: 10 })], [])).toEqual([])
  })
})

describe('optimisation d’itinéraire', () => {
  it('trouve un ordre plus court que l’ordre saisi', () => {
    const start = { lat: 34.74, lng: 10.76 }
    // Ordre saisi en zigzag sur une ligne
    const stops = [{ lat: 34.94, lng: 10.76 }, { lat: 34.79, lng: 10.76 }, { lat: 35.04, lng: 10.76 }, { lat: 34.84, lng: 10.76 }]
    const r = optimizeRoute(start, stops)
    expect(r.order).toEqual([1, 3, 0, 2])
    expect(r.distanceKm).toBeLessThan(r.naiveKm)
    expect(r.savedPct).toBeGreaterThan(0)
    expect(pathKm(start, r.order.map((i) => stops[i]))).toBeCloseTo(r.distanceKm, 0)
  })
})

describe('identifiant de lot', () => {
  it('accepte le code, sa version courte ou l’URL du QR code', () => {
    expect(normalizeCode('lot-ab12cd')).toBe('LOT-AB12CD')
    expect(normalizeCode('AB12CD')).toBe('LOT-AB12CD')
    expect(normalizeCode('http://localhost:5173/trace/LOT-AB12CD')).toBe('LOT-AB12CD')
  })
})
