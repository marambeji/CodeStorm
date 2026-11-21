import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { analyzeInvoice } from '../invoice/invoice.engine.js'
import { SimulatedHydroProvider, zonesCollection } from '../hydro/hydro.engine.js'
import { analyzeReadings } from '../meter/consumption.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { IRRIGATION_EFFICIENCY, type Irrigation } from '../terrain/estimation.js'

/**
 * Tableau de bord : agrège les 5 modules et calcule l'éco-score, les alertes,
 * les badges et les objectifs. Tout est calculé ici par des règles simples et
 * documentées (aucune valeur inventée par l'IA).
 */
export type AlertSeverity = 'critique' | 'élevée' | 'moyenne' | 'info'
export interface DashboardAlert {
  id: string
  module: 'plantdoc' | 'terracalc' | 'factureia' | 'hydromap' | 'aquascan'
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
  private readonly hydro = new SimulatedHydroProvider()

  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [diagnoses, invoices, terrains, meters, observations] = await Promise.all([
      this.prisma.plantDiagnosis.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.invoice.findMany({ orderBy: { periodEnd: 'asc' } }),
      this.prisma.terrain.findMany({ include: { species: { select: { name: true } } } }),
      this.prisma.meter.findMany({ include: { readings: true } }),
      this.prisma.hydroObservation.count(),
    ])
    const alerts: DashboardAlert[] = []

    // ── PlantDoc : part des diagnostics sains ou traités (30 derniers jours) ──
    const recent = diagnoses.filter((d) => Date.now() - d.createdAt.getTime() < 30 * DAY)
    const sick = diagnoses.filter((d) => d.severity !== 'aucune')
    const toTreat = sick.filter((d) => d.status !== 'traite')
    const okShare = recent.length ? recent.filter((d) => d.severity === 'aucune' || d.status === 'traite').length / recent.length : null
    toTreat
      .filter((d) => d.severity === 'élevée' || d.severity === 'moyenne')
      .forEach((d) =>
        alerts.push({
          id: `plant-${d.id}`,
          module: 'plantdoc',
          severity: d.severity === 'élevée' ? 'élevée' : 'moyenne',
          title: `${d.disease} : ${d.parcel}`,
          detail: d.status === 'en-cours' ? 'Traitement en cours, à surveiller.' : 'À traiter rapidement.',
          link: '/app/plantdoc',
          date: d.createdAt.toISOString(),
        }),
      )
    // Score : 100 si tout est sain/traité ; chaque maladie active sévère pèse plus lourd
    const plantScore = Math.round(clamp(100 - toTreat.reduce((s, d) => s + (d.severity === 'élevée' ? 18 : d.severity === 'moyenne' ? 10 : 5), 0)))

    // ── FactureIA ──
    const last = invoices.at(-1) ?? null
    const lastAnalysis = last ? analyzeInvoice(last, invoices.at(-2) ?? null) : null
    let energyScore = 70
    if (lastAnalysis) {
      if (lastAnalysis.changeVsPrevious !== null) energyScore += clamp(-lastAnalysis.changeVsPrevious, -20, 20)
      if (lastAnalysis.hcShare !== null) energyScore += clamp((lastAnalysis.hcShare - 0.3) * 100, -10, 10)
      if (lastAnalysis.changeVsPrevious !== null && lastAnalysis.changeVsPrevious > 10) {
        alerts.push({
          id: `invoice-${last!.id}`,
          module: 'factureia',
          severity: 'moyenne',
          title: `Facture en hausse : ${last!.label}`,
          detail: `+${Math.round(lastAnalysis.changeVsPrevious)} % de consommation par jour par rapport à la facture précédente.`,
          link: '/app/factureia',
          date: last!.periodEnd.toISOString(),
        })
      }
    }
    // Comparaison des 3 derniers mois avec les 3 précédents (objectif -10 %)
    const kwh3 = invoices.slice(-3).reduce((s, i) => s + i.kwh, 0)
    const kwhPrev3 = invoices.slice(-6, -3).reduce((s, i) => s + i.kwh, 0)
    const energyTrend = kwhPrev3 ? ((kwh3 - kwhPrev3) / kwhPrev3) * 100 : null

    // ── HydroMap ──
    const zones = zonesCollection(this.hydro).features.map((f) => f.properties)
    const avgStress = zones.reduce((s, z) => s + z.stress, 0) / zones.length
    const levels = { faible: 0, modéré: 0, élevé: 0, critique: 0 } as Record<string, number>
    zones.forEach((z) => levels[z.level]++)
    zones
      .filter((z) => z.level === 'critique')
      .forEach((z) =>
        alerts.push({
          id: `hydro-${z.id}`,
          module: 'hydromap',
          severity: 'critique',
          title: `Stress hydrique critique : ${z.name}`,
          detail: `Stress à ${Math.round(z.stress * 100)} %, pluies ${z.rainfallAnomaly} % sous la normale.`,
          link: '/app/hydromap',
          date: new Date().toISOString(),
        }),
      )
    const hydroScore = Math.round(clamp((1 - avgStress) * 100))

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
      { id: 'plantdoc', label: 'Santé des cultures', score: plantScore, weight: 0.25 },
      { id: 'aquascan', label: 'Eau du foyer', score: waterScore, weight: 0.25 },
      { id: 'factureia', label: 'Énergie', score: Math.round(clamp(energyScore)), weight: 0.2 },
      { id: 'hydromap', label: 'Ressource en eau du territoire', score: hydroScore, weight: 0.15 },
      { id: 'terracalc', label: 'Irrigation des terrains', score: terrainScore, weight: 0.15 },
    ]
    const ecoScore = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0))

    // ── Badges (débloqués ou non) ──
    const badges = [
      { id: 'zero-fuite', label: 'Zéro fuite', description: 'Aucune fuite détectée sur vos compteurs.', unlocked: meters.length > 0 && leaks === 0 },
      { id: 'main-verte', label: 'Main verte', description: '80 % de vos cultures saines ou traitées ce mois-ci.', unlocked: okShare !== null && okShare >= 0.8 },
      { id: 'econome', label: 'Économe', description: 'Consommation électrique en baisse sur 3 mois.', unlocked: energyTrend !== null && energyTrend < 0 },
      { id: 'goutte', label: 'Goutte à goutte', description: 'Tous vos terrains sont irrigués au goutte-à-goutte.', unlocked: terrains.length > 0 && terrains.every((t) => t.irrigation === 'goutte-a-goutte') },
      { id: 'vigie', label: 'Vigie de l’eau', description: 'Au moins 3 observations de terrain partagées.', unlocked: observations >= 3 },
      { id: 'analyste', label: 'Analyste', description: '10 factures analysées.', unlocked: invoices.length >= 10 },
    ]

    // ── Objectifs (avec progression) ──
    const goals = [
      {
        id: 'fuite',
        label: 'Réparer les fuites',
        progress: meters.length ? (meters.length - leaks) / meters.length : 1,
        detail: leaks ? `${leaks} compteur${leaks > 1 ? 's' : ''} en alerte` : 'Aucune fuite',
        link: '/app/aquascan',
      },
      {
        id: 'maladies',
        label: 'Traiter toutes les maladies',
        progress: sick.length ? (sick.length - toTreat.length) / sick.length : 1,
        detail: `${sick.length - toTreat.length} sur ${sick.length} traitées`,
        link: '/app/plantdoc',
      },
      {
        id: 'heures-creuses',
        label: 'Passer 35 % de l’électricité en heures creuses',
        progress: lastAnalysis?.hcShare != null ? Math.min(1, lastAnalysis.hcShare / 0.35) : 0,
        detail: lastAnalysis?.hcShare != null ? `${Math.round(lastAnalysis.hcShare * 100)} % aujourd’hui` : 'Option HP/HC non détectée',
        link: '/app/factureia',
      },
      {
        id: 'baisse-conso',
        label: 'Réduire la consommation électrique de 10 %',
        progress: energyTrend === null ? 0 : clamp(-energyTrend / 10, 0, 1),
        detail: energyTrend === null ? 'Pas assez de factures' : `${energyTrend > 0 ? '+' : ''}${Math.round(energyTrend)} % sur les 3 derniers mois`,
        link: '/app/factureia',
      },
    ]

    const order: Record<AlertSeverity, number> = { critique: 0, élevée: 1, moyenne: 2, info: 3 }
    alerts.sort((a, b) => order[a.severity] - order[b.severity] || b.date.localeCompare(a.date))

    return {
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
        factureia: {
          count: invoices.length,
          last: last && lastAnalysis ? { label: last.label, amount: last.amount, kwh: last.kwh, change: lastAnalysis.changeVsPrevious, yearlyCost: lastAnalysis.projectedYearlyCost } : null,
          series: invoices.slice(-12).map((i) => ({ month: i.periodEnd.toISOString().slice(0, 7), kwh: i.kwh, amount: i.amount })),
        },
        hydromap: { zones: zones.length, levels, averageStress: Math.round(avgStress * 1000) / 1000, worst: [...zones].sort((a, b) => b.stress - a.stress)[0] },
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

  /** GET /api/dashboard : synthèse des 5 modules, éco-score, alertes, badges, objectifs */
  @Get()
  summary() {
    return this.dashboard.summary()
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService], exports: [DashboardService] })
export class DashboardModule {}
