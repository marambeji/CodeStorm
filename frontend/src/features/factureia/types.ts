export interface Tier {
  label: string
  kwh: number | null
  unitPrice: number | null
  amount: number
}

export interface Invoice {
  id: string
  label: string
  supplier: string | null
  periodStart: string
  periodEnd: string
  kwh: number
  hpKwh: number | null
  hcKwh: number | null
  amount: number
  subscriptionKva: number | null
  offer: 'base' | 'hphc'
  explanation: string
  tips: string[]
  extraction: 'auto' | 'partielle' | 'manuelle'
  fileName: string | null
  analysis: {
    offer: 'base' | 'hphc'
    days: number
    tiers: Tier[]
    pricePerKwh: number
    kwhPerDay: number
    projectedYearlyKwh: number
    projectedYearlyCost: number
    hcShare: number | null
    changeVsPrevious: number | null
    fileUrl: string | null
    missing: string[]
  }
  createdAt: string
  updatedAt: string
}

export interface Tariffs {
  baseKwh: number
  hpKwh: number
  hcKwh: number
  subscriptionMonthly: Record<string, number>
  usages: {
    washingMachineKwh: number
    dishwasherKwh: number
    waterHeaterKwhPerDay: number
    heatingShareOfBill: number
    heatingSavingPerDegree: number
    ledSavingPerBulbKwhYear: number
  }
}

export interface InvoiceInput {
  label?: string
  supplier?: string
  periodStart: string
  periodEnd: string
  kwh: number
  hpKwh: number | null
  hcKwh: number | null
  amount: number
  subscriptionKva: number | null
}

export const MISSING_LABEL: Record<string, string> = {
  periodStart: 'début de période',
  periodEnd: 'fin de période',
  kwh: 'consommation',
  amount: 'montant',
}
