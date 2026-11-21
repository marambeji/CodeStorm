/**
 * Moteur AquaScan : consommation d'eau entre relevés et détection de fuite.
 *
 * Règle de détection (simple et explicable) :
 *  - consommation de la période en litres/jour
 *  - comparée à la "consommation habituelle" = médiane des périodes précédentes NORMALES
 *    (au moins 2 périodes d'historique ; les périodes anormales sont exclues pour ne pas
 *    "habituer" le calcul à une fuite)
 *  - anomalie si > 1,6 × l'habitude ET au moins +150 L/jour
 */
export interface ReadingLike {
  id: string
  value: number // index en m³
  readAt: Date
}

export const LEAK_RULE = { ratio: 1.6, minExcessLitersPerDay: 150, historyPeriods: 6 }

const DAY = 86_400_000
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function analyzeReadings(readings: ReadingLike[]) {
  const sorted = [...readings].sort((a, b) => a.readAt.getTime() - b.readAt.getTime())
  const periods: {
    toReadingId: string
    from: string
    to: string
    days: number
    m3: number
    litersPerDay: number
    baseline: number | null
    anomaly: boolean
  }[] = []

  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]
    const b = sorted[i]
    const days = Math.max((b.readAt.getTime() - a.readAt.getTime()) / DAY, 1 / 24)
    const m3 = b.value - a.value
    const litersPerDay = (m3 * 1000) / days
    const normal = periods.filter((p) => !p.anomaly).slice(-LEAK_RULE.historyPeriods)
    const baseline = normal.length >= 2 ? median(normal.map((p) => p.litersPerDay)) : null
    const anomaly = baseline !== null && litersPerDay > baseline * LEAK_RULE.ratio && litersPerDay - baseline >= LEAK_RULE.minExcessLitersPerDay
    periods.push({
      toReadingId: b.id,
      from: a.readAt.toISOString(),
      to: b.readAt.toISOString(),
      days: round(days, 2),
      m3: round(m3, 3),
      litersPerDay: Math.round(litersPerDay),
      baseline: baseline === null ? null : Math.round(baseline),
      anomaly,
    })
  }

  const last = periods.at(-1) ?? null
  const normal = periods.filter((p) => !p.anomaly)
  const totalDays = periods.reduce((s, p) => s + p.days, 0)
  return {
    periods,
    stats: {
      readings: sorted.length,
      lastIndex: sorted.at(-1)?.value ?? null,
      lastReadAt: sorted.at(-1)?.readAt.toISOString() ?? null,
      averageLitersPerDay: totalDays ? Math.round((periods.reduce((s, p) => s + p.m3, 0) * 1000) / totalDays) : null,
      usualLitersPerDay: normal.length ? Math.round(median(normal.map((p) => p.litersPerDay))) : null,
      lastLitersPerDay: last?.litersPerDay ?? null,
      leakAlert: Boolean(last?.anomaly),
      /** Litres "en trop" par jour sur la dernière période (si fuite suspectée) */
      excessLitersPerDay: last?.anomaly && last.baseline !== null ? last.litersPerDay - last.baseline : 0,
    },
  }
}

/**
 * Un index de compteur ne peut pas diminuer : vérifie la cohérence avec les relevés
 * avant et après la date choisie. Renvoie un message d'erreur clair, ou null si tout va bien.
 */
export function checkIndexConsistency(readings: ReadingLike[], value: number, readAt: Date, ignoreId?: string): string | null {
  const others = readings.filter((r) => r.id !== ignoreId)
  const before = others.filter((r) => r.readAt <= readAt).sort((a, b) => b.readAt.getTime() - a.readAt.getTime())[0]
  const after = others.filter((r) => r.readAt > readAt).sort((a, b) => a.readAt.getTime() - b.readAt.getTime())[0]
  const fmt = (r: ReadingLike) => `${r.value.toLocaleString('fr-FR').replace(/ /g, ' ')} m³ le ${r.readAt.toLocaleDateString('fr-FR')}`
  if (before && value < before.value) return `L’index ne peut pas diminuer : le relevé précédent indique ${fmt(before)}. Vérifiez la lecture.`
  if (after && value > after.value) return `L’index dépasse celui du relevé suivant (${fmt(after)}). Vérifiez la date ou la valeur.`
  return null
}
