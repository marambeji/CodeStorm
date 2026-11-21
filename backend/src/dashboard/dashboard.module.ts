import { Controller, Get, Injectable, Module } from '@nestjs/common'
import type { Plan } from '../irrigation/irrigation.engine.js'
import { analyzeReadings } from '../meter/consumption.js'
import { CurrentUserId } from '../auth/auth.module.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { IRRIGATION_EFFICIENCY, type Irrigation } from '../terrain/estimation.js'

/**
 * Tableau de bord : agrège les modules et calcule l'éco-score, les alertes,
 * les badges et les objectifs. Tout est calculé ici par des règles simples et
 * documentées (aucune valeur inventée par l'IA).
 */
export type AlertSeverity = 'critique' | 'élevée' | 'moyenne' | 'info'
export interface DashboardAlert {
  id: string
  module: 'plantdoc' | 'terracalc' | 'irriplan' | 'aquascan'
  severity: AlertSeverity
  title: string
  detail: string
  link: string
  date: string
}

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n))
const DAY = 86_400_000

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userId: CurrentUserId,
  ) {}

  async summary() {
    const userId = this.userId.get()
    const [diagnoses, terrains, meters, plans, profile] = await Promise.all([
      this.prisma.plantDiagnosis.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.terrain.findMany({ where: { userId } }),
      this.prisma.meter.findMany({ where: { userId }, include: { readings: true } }),
      this.prisma.irrigationPlan.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true, farmName: true, placeName: true } }),
    ])
    const alerts: DashboardAlert[] = []
    const today = new Date().toISOString().slice(0, 10)

    // ── PlantDoc : on ne garde que le DERNIER diagnostic de chaque parcelle (les anciens sont dépassés) ──
    const recent = diagnoses.filter((d) => Date.now() - d.createdAt.getTime() < 30 * DAY)
    const sick = diagnoses.filter((d) => d.severity !== 'aucune')
    const toTreat = sick.filter((d) => d.status !== 'traite')
    const okShare = recent.length ? recent.filter((d) => d.severity === 'aucune' || d.status === 'traite').length / recent.length : null
    const latest = diagnoses.filter((d, i) => diagnoses.findIndex((x) => x.parcel === d.parcel) === i)
    const cropNames = new Set(['tomate', 'pomme de terre', 'vigne', 'pommier', 'poivron', 'maïs'])
    latest
      .filter((d) => d.status !== 'traite' && (d.severity === 'élevée' || d.severity === 'moyenne'))
      .forEach((d) =>
        alerts.push({
          id: `plant-${d.id}`,
          module: 'plantdoc',
          severity: d.severity === 'élevée' ? 'élevée' : 'moyenne',
          // Pas de répétition « Mildiou de la tomate : Tomate » quand la parcelle porte le nom de la culture
          title: cropNames.has(d.parcel.toLowerCase()) || d.disease.toLowerCase().includes(d.parcel.toLowerCase()) ? d.disease : `${d.disease} : ${d.parcel}`,
          detail: d.status === 'en-cours' ? 'Traitement en cours, à surveiller.' : 'À traiter rapidement.',
          link: '/app/plantdoc',
          date: d.createdAt.toISOString(),
        }),
      )
    // Score : part des parcelles en bonne santé, selon la gravité de leur dernier diagnostic (traitement en cours = moitié du risque)
    const WEIGHT: Record<string, number> = { aucune: 0, faible: 0.3, moyenne: 0.6, élevée: 1 }
    const risk = latest.reduce((s, d) => s + (d.status === 'traite' ? 0 : (WEIGHT[d.severity] ?? 0) * (d.status === 'en-cours' ? 0.5 : 1)), 0)
    const plantScore = latest.length ? Math.round(clamp(100 * (1 - risk / latest.length))) : 70

    // ── IrriPlan : arrosages du jour, suivi du plan, eau économisée ──
    const parsed = plans.map((p) => ({ ...p, plan: JSON.parse(p.plan) as Plan, done: JSON.parse(p.doneDays) as string[] }))
    let due = 0
    let followed = 0
    let savedM3 = 0
    let weekM3 = 0
    let weekKwh = 0
    for (const p of parsed) {
      savedM3 += p.plan.comparison.savedM3
      weekM3 += p.plan.totals.volumeM3
      weekKwh += p.plan.totals.kwh
      for (const d of p.plan.days) {
        if (!d.irrigate || d.date > today) continue
        due++
        if (p.done.includes(d.date)) followed++
        else if (d.date === today)
          alerts.push({
            id: `irr-${p.id}-${d.date}`,
            module: 'irriplan',
            severity: 'info',
            title: `Arroser aujourd’hui : ${p.name}`,
            detail: `${d.volumeM3} m³${d.litersPerTree ? ` (${d.litersPerTree} L par arbre)` : ''}${d.durationH ? `, environ ${d.durationH} h` : ''}.`,
            link: '/app/irriplan',
            date: new Date().toISOString(),
          })
      }
      const heat = p.plan.days.find((d) => d.date >= today && d.tMax >= 35)
      if (heat)
        alerts.push({
          id: `heat-${p.id}`,
          module: 'irriplan',
          severity: 'moyenne',
          title: `Forte chaleur prévue : ${p.name}`,
          detail: `${Math.round(heat.tMax)} °C le ${heat.date} : irriguez tôt le matin.`,
          link: '/app/irriplan',
          date: new Date().toISOString(),
        })
    }
    const adherence = due ? followed / due : null
    const irrigationScore = parsed.length ? Math.round(clamp(55 + (adherence ?? 0.5) * 30 + Math.min(15, savedM3 / 10))) : 60

    // ── AquaScan ──
    const meterStats = meters.map((m) => ({ id: m.id, name: m.name, ...analyzeReadings(m.readings) }))
    meterStats
      .filter((m) => m.stats.leakAlert)
      .forEach((m) =>
        alerts.push({
          id: `leak-${m.id}`,
          module: 'aquascan',
          severity: 'critique',
          title: `Fuite possible : ${m.name}`,
          detail: `${m.stats.lastLitersPerDay} L/jour contre ${m.stats.lastLitersPerDay! - m.stats.excessLitersPerDay} L/jour d’habitude.`,
          link: '/app/aquascan',
          date: m.stats.lastReadAt ?? new Date().toISOString(),
        }),
      )
    const leaks = meterStats.filter((m) => m.stats.leakAlert).length
    const waterScore = meters.length ? Math.round(clamp(100 - leaks * 45)) : 70

    // ── TerraCalc : efficience moyenne de l'irrigation, pondérée par la surface ──
    const totalHa = terrains.reduce((s, t) => s + t.areaM2 / 10_000, 0)
    const efficiency = totalHa
      ? terrains.reduce((s, t) => s + (t.areaM2 / 10_000) * (t.irrigation === 'pluvial' ? 1 : IRRIGATION_EFFICIENCY[(t.irrigation ?? 'goutte-a-goutte') as Irrigation]), 0) / totalHa
      : null
    const estimates = terrains.map((t) => (t.estimate ? (JSON.parse(t.estimate) as { trees: { count: number } | null; production: { kgPerYear: number }; co2: { kgPerYear: number } }) : null))
    const terrainScore = efficiency !== null ? Math.round(clamp(((efficiency - 0.5) / 0.4) * 100)) : 70

    // ── Éco-score global (moyenne pondérée) ──
    const parts = [
      { id: 'plantdoc', label: 'Santé des cultures', score: plantScore, weight: 0.3 },
      { id: 'aquascan', label: 'Eau du foyer', score: waterScore, weight: 0.25 },
      { id: 'irriplan', label: 'Irrigation intelligente', score: irrigationScore, weight: 0.25 },
      { id: 'terracalc', label: 'Irrigation des terrains', score: terrainScore, weight: 0.2 },
    ]
    const ecoScore = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0))

    const badges = [
      { id: 'zero-fuite', label: 'Zéro fuite', description: 'Aucune fuite détectée sur vos compteurs.', unlocked: meters.length > 0 && leaks === 0 },
      { id: 'main-verte', label: 'Main verte', description: '80 % de vos cultures saines ou traitées ce mois-ci.', unlocked: okShare !== null && okShare >= 0.8 },
      { id: 'econome', label: 'Économe en eau', description: 'Plus de 10 m³ économisés grâce à IrriPlan cette semaine.', unlocked: savedM3 >= 10 },
      { id: 'goutte', label: 'Goutte à goutte', description: 'Tous vos terrains sont irrigués au goutte-à-goutte.', unlocked: terrains.length > 0 && terrains.every((t) => t.irrigation === 'goutte-a-goutte') },
      { id: 'vigie', label: 'Régulier', description: 'Tous les arrosages prévus ont été faits.', unlocked: adherence === 1 },
      { id: 'analyste', label: 'Planificateur', description: 'Au moins 2 plans d’irrigation créés.', unlocked: plans.length >= 2 },
    ]

    const goals = [
      { id: 'fuite', label: 'Réparer les fuites', progress: meters.length ? (meters.length - leaks) / meters.length : 1, detail: leaks ? `${leaks} compteur${leaks > 1 ? 's' : ''} en alerte` : 'Aucune fuite', link: '/app/aquascan' },
      { id: 'maladies', label: 'Traiter toutes les maladies', progress: sick.length ? (sick.length - toTreat.length) / sick.length : 1, detail: `${sick.length - toTreat.length} sur ${sick.length} traitées`, link: '/app/plantdoc' },
      { id: 'heures-creuses', label: 'Suivre le plan d’irrigation', progress: adherence ?? 0, detail: due ? `${followed} arrosage(s) faits sur ${due}` : 'Aucun arrosage prévu pour l’instant', link: '/app/irriplan' },
      { id: 'baisse-conso', label: 'Économiser 20 m³ d’eau par semaine', progress: Math.min(1, savedM3 / 20), detail: `${Math.round(savedM3)} m³ économisés cette semaine`, link: '/app/irriplan' },
    ]

    const order: Record<AlertSeverity, number> = { critique: 0, élevée: 1, moyenne: 2, info: 3 }
    alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.date.localeCompare(a.date))

    const next = parsed.flatMap((p) => p.plan.days.filter((d) => d.irrigate && d.date >= today && !p.done.includes(d.date)).map((d) => ({ plan: p.name, ...d }))).sort((a, b) => a.date.localeCompare(b.date))[0]

    return {
      profile: profile ? { name: profile.name, farmName: profile.farmName, placeName: profile.placeName } : null,
      ecoScore,
      parts,
      alerts,
      badges,
      goals,
      modules: {
        plantdoc: { total: diagnoses.length, toTreat: toTreat.length, healthyShare: okShare, parcels: new Set(diagnoses.map((d) => d.parcel)).size, latest: diagnoses.slice(0, 3).map((d) => ({ id: d.id, disease: d.disease, parcel: d.parcel, severity: d.severity })) },
        terracalc: {
          count: terrains.length,
          hectares: Math.round(totalHa * 100) / 100,
          trees: estimates.reduce((s, e) => s + (e?.trees?.count ?? 0), 0),
          productionKg: estimates.reduce((s, e) => s + (e?.production.kgPerYear ?? 0), 0),
          co2Kg: estimates.reduce((s, e) => s + (e?.co2.kgPerYear ?? 0), 0),
        },
        irriplan: {
          plans: plans.length,
          weekM3: Math.round(weekM3 * 10) / 10,
          weekKwh: Math.round(weekKwh * 10) / 10,
          savedM3: Math.round(savedM3 * 10) / 10,
          adherence,
          next: next ? { plan: next.plan, date: next.date, volumeM3: next.volumeM3 } : null,
          series: parsed[0]?.plan.days.map((d) => ({ date: d.date, m3: d.volumeM3, rain: d.rain })) ?? [],
        },
        aquascan: {
          meters: meters.length,
          leaks,
          usualLitersPerDay: meterStats.reduce((s, m) => s + (m.stats.usualLitersPerDay ?? 0), 0),
          series: (meterStats.find((m) => m.stats.leakAlert) ?? meterStats[0])?.periods.slice(-8).map((p) => ({ date: p.to.slice(0, 10), liters: p.litersPerDay, anomaly: p.anomaly })) ?? [],
        },
      },
    }
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /api/dashboard : synthèse des modules, éco-score, alertes, badges, objectifs */
  @Get()
  summary() {
    return this.dashboard.summary()
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService], exports: [DashboardService] })
export class DashboardModule {}
