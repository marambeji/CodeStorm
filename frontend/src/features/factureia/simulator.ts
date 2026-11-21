import type { Tariffs } from './types'

/**
 * Simulateur d'économies FactureIA : formules simples et transparentes,
 * à partir des tarifs de référence fournis par le backend.
 */
export interface SimulatorInput {
  washingShifted: number // cycles de lave-linge par semaine décalés en heures creuses
  dishwasherShifted: number // cycles de lave-vaisselle par semaine décalés
  waterHeaterNight: boolean // chauffe-eau programmé la nuit
  thermostatDown: number // degrés de chauffage en moins
  electricHeating: boolean // logement chauffé à l'électricité
  ledBulbs: number // ampoules halogènes remplacées par des LED
}

export const DEFAULT_SIMULATION: SimulatorInput = {
  washingShifted: 3,
  dishwasherShifted: 2,
  waterHeaterNight: false,
  thermostatDown: 1,
  electricHeating: true,
  ledBulbs: 5,
}

export function simulateSavings(t: Tariffs, input: SimulatorInput, ctx: { yearlyCost: number; pricePerKwh: number }) {
  const gap = t.hpKwh - t.hcKwh // gain par kWh déplacé en heures creuses
  const u = t.usages
  const lines = [
    { id: 'washing', label: 'Lave-linge la nuit', kwh: 0, eur: input.washingShifted * 52 * u.washingMachineKwh * gap },
    { id: 'dishwasher', label: 'Lave-vaisselle la nuit', kwh: 0, eur: input.dishwasherShifted * 52 * u.dishwasherKwh * gap },
    { id: 'waterHeater', label: 'Chauffe-eau en heures creuses', kwh: 0, eur: input.waterHeaterNight ? u.waterHeaterKwhPerDay * 365 * gap : 0 },
    {
      id: 'thermostat',
      label: `Chauffage à -${input.thermostatDown} °C`,
      kwh: 0,
      eur: input.electricHeating ? ctx.yearlyCost * u.heatingShareOfBill * u.heatingSavingPerDegree * input.thermostatDown : 0,
    },
    { id: 'led', label: 'Ampoules LED', kwh: input.ledBulbs * u.ledSavingPerBulbKwhYear, eur: input.ledBulbs * u.ledSavingPerBulbKwhYear * ctx.pricePerKwh },
  ]
  // kWh réellement économisés (le décalage horaire ne réduit pas la consommation, seulement le prix)
  const thermostat = lines.find((l) => l.id === 'thermostat')!
  thermostat.kwh = thermostat.eur / Math.max(ctx.pricePerKwh, 0.01)
  const total = lines.reduce((s, l) => s + l.eur, 0)
  const kwhSaved = lines.reduce((s, l) => s + l.kwh, 0)
  return { lines, total, kwhSaved, co2Kg: kwhSaved * 0.06 } // ~60 g de CO2 par kWh (mix électrique bas carbone)
}
