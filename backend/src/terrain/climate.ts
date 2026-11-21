/**
 * Climat d'un lieu, mois par mois : évapotranspiration de référence ET0 et pluie.
 *  1. NASA POWER (gratuit, sans clé) : normales climatiques sur 20 ans (2001-2020),
 *     ET0 calculée par la formule de Hargreaves (FAO-56, éq. 52) à partir des températures.
 *  2. Secours : Open-Meteo Archive (12 derniers mois, ET0 Penman-Monteith).
 * Mis en cache en mémoire par lieu (arrondi à ~1 km).
 */
export interface Climate {
  source: 'nasa-power' | 'open-meteo'
  from: string
  to: string
  et0Mm: number
  rainMm: number
  monthly: { month: string; et0: number; rain: number }[]
}

const cache = new Map<string, { at: number; climate: Climate }>()
const DAY = 86_400_000

export async function fetchClimate(lat: number, lng: number): Promise<Climate | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < DAY) return hit.climate
  const climate = (await nasaPower(lat, lng)) ?? (await openMeteoArchive(lat, lng))
  if (climate) cache.set(key, { at: Date.now(), climate })
  return climate
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS_IN_MONTH = [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/** Rayonnement extraterrestre Ra (MJ/m²/jour), FAO-56 éq. 21, au milieu du mois */
export function extraterrestrialRadiation(latDeg: number, month: number) {
  const J = Math.round(30.4 * month + 15)
  const phi = (latDeg * Math.PI) / 180
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365) * J)
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365) * J - 1.39)
  const ws = Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi) * Math.tan(delta))))
  return ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
}

/** ET0 de Hargreaves (mm/jour), FAO-56 éq. 52 */
export function hargreavesEt0(tMean: number, tRange: number, ra: number) {
  return Math.max(0, 0.0023 * (tMean + 17.8) * Math.sqrt(Math.max(0, tRange)) * 0.408 * ra)
}

async function nasaPower(lat: number, lng: number): Promise<Climate | null> {
  try {
    const url =
      'https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=T2M,T2M_RANGE,PRECTOTCORR&community=AG' +
      `&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const d = (await res.json()) as { properties?: { parameter?: Record<'T2M' | 'T2M_RANGE' | 'PRECTOTCORR', Record<string, number>> } }
    const p = d.properties?.parameter
    if (!p) return null
    const monthly = MONTHS.map((m, i) => {
      const et0 = hargreavesEt0(p.T2M[m], p.T2M_RANGE[m], extraterrestrialRadiation(lat, i)) * DAYS_IN_MONTH[i]
      return { month: m, et0: Math.round(et0 * 10) / 10, rain: Math.round(p.PRECTOTCORR[m] * DAYS_IN_MONTH[i] * 10) / 10 }
    })
    if (monthly.some((m) => !Number.isFinite(m.et0) || !Number.isFinite(m.rain) || m.rain < 0)) return null
    return { source: 'nasa-power', from: '2001', to: '2020', et0Mm: Math.round(monthly.reduce((s, m) => s + m.et0, 0)), rainMm: Math.round(monthly.reduce((s, m) => s + m.rain, 0)), monthly }
  } catch {
    return null
  }
}

async function openMeteoArchive(lat: number, lng: number): Promise<Climate | null> {
  const end = new Date(Date.now() - 6 * DAY) // l'archive a quelques jours de retard
  const start = new Date(end.getTime() - 364 * DAY)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  try {
    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}` +
      `&start_date=${iso(start)}&end_date=${iso(end)}&daily=et0_fao_evapotranspiration,precipitation_sum&timezone=auto`
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const d = (await res.json()) as { daily?: { time: string[]; et0_fao_evapotranspiration: (number | null)[]; precipitation_sum: (number | null)[] } }
    if (!d.daily?.time?.length) return null
    const months = new Map<string, { et0: number; rain: number }>()
    d.daily.time.forEach((t, i) => {
      const m = t.slice(0, 7)
      const cur = months.get(m) ?? { et0: 0, rain: 0 }
      cur.et0 += d.daily!.et0_fao_evapotranspiration[i] ?? 0
      cur.rain += d.daily!.precipitation_sum[i] ?? 0
      months.set(m, cur)
    })
    const monthly = [...months].map(([month, v]) => ({ month, et0: Math.round(v.et0 * 10) / 10, rain: Math.round(v.rain * 10) / 10 }))
    const climate: Climate = {
      source: 'open-meteo',
      from: iso(start),
      to: iso(end),
      et0Mm: Math.round(monthly.reduce((s, m) => s + m.et0, 0)),
      rainMm: Math.round(monthly.reduce((s, m) => s + m.rain, 0)),
      monthly,
    }
    return climate
  } catch {
    return null
  }
}

/** Pluie efficace mensuelle (méthode USDA-SCS simplifiée, utilisée par la FAO) */
export function effectiveMonthlyRain(mm: number) {
  return mm > 75 ? 0.8 * mm - 25 : Math.max(0, 0.6 * mm - 10)
}
