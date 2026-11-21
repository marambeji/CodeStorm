import { analyzeInvoice, invoiceLabel, parseFrenchNumber, parseInvoiceText, TARIFFS } from './invoice.engine.js'

const SAMPLE = `ÉnergiePlus - Facture d'électricité
Fournisseur : ÉnergiePlus
Période de consommation du 01/09/2026 au 31/10/2026
Puissance souscrite : 6 kVA - Option Heures Pleines / Heures Creuses
Heures pleines : 612 kWh
Heures creuses : 298 kWh
Consommation totale : 910 kWh
Total TTC : 263,45 €`

describe('lecture de facture', () => {
  it('comprend les nombres au format français', () => {
    expect(parseFrenchNumber('1 234,56')).toBe(1234.56)
    expect(parseFrenchNumber('1 234')).toBe(1234)
    expect(parseFrenchNumber('1.234,5')).toBe(1234.5)
    expect(parseFrenchNumber('263,45')).toBe(263.45)
  })

  it('extrait période, kWh, heures pleines/creuses, montant et puissance', () => {
    const f = parseInvoiceText(SAMPLE)
    expect(f.periodStart?.toISOString().slice(0, 10)).toBe('2026-09-01')
    expect(f.periodEnd?.toISOString().slice(0, 10)).toBe('2026-10-31')
    expect(f.hpKwh).toBe(612)
    expect(f.hcKwh).toBe(298)
    expect(f.kwh).toBe(910)
    expect(f.amount).toBe(263.45)
    expect(f.subscriptionKva).toBe(6)
    expect(f.supplier).toBe('ÉnergiePlus')
  })

  it('laisse à null ce qu’il ne trouve pas, et additionne HP + HC si le total manque', () => {
    const f = parseInvoiceText('Heures pleines 100 kWh\nHeures creuses 50 kWh')
    expect(f.kwh).toBe(150)
    expect(f.amount).toBeNull()
    expect(f.periodStart).toBeNull()
  })
})

describe('analyse', () => {
  const inv = {
    periodStart: new Date('2026-09-01'),
    periodEnd: new Date('2026-10-31'),
    kwh: 910,
    hpKwh: 612,
    hcKwh: 298,
    amount: 263.45,
    subscriptionKva: 6,
  }

  it('décompose le montant : abonnement + HP + HC + taxes = total', () => {
    const a = analyzeInvoice(inv)
    expect(a.offer).toBe('hphc')
    expect(a.days).toBe(61)
    const sum = a.tiers.reduce((s, t) => s + t.amount, 0)
    expect(sum).toBeCloseTo(263.45, 1)
    expect(a.tiers.find((t) => t.label === 'Heures pleines')!.amount).toBeCloseTo(612 * TARIFFS.hpKwh, 2)
    expect(a.hcShare).toBeCloseTo(298 / 910, 2)
  })

  it('compare à la facture précédente (consommation par jour)', () => {
    const prev = { ...inv, periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-08-31'), kwh: 700 }
    const a = analyzeInvoice(inv, prev)
    // (910 kWh / 61 j) ÷ (700 kWh / 62 j) - 1 = +32,1 %
    expect(a.changeVsPrevious).toBeCloseTo(32.1, 1)
  })
})

describe('libellé', () => {
  it('élide devant une voyelle', () => {
    expect(invoiceLabel(new Date('2026-10-31'))).toBe('Facture d’octobre 2026')
    expect(invoiceLabel(new Date('2026-03-31'))).toBe('Facture de mars 2026')
  })
})
