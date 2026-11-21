import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Estimate, SpeciesRef } from '../terrain/estimation.js'
import type { DiseaseInfo } from '../plant/diseases.data.js'
import type { InvoiceAnalysis, InvoiceData } from '../invoice/invoice.engine.js'
import type { StressLevel, ZoneProps } from '../hydro/hydro.engine.js'
import { mockHydroOverview, mockZoneSummary } from './hydro-summary.mock.js'
import { mockAssistant } from './assistant.mock.js'
import type { DashboardService } from '../dashboard/dashboard.module.js'
import { mockInvoiceAdvice } from './invoice-advice.mock.js'
import { mockPlantAdvice, mockPlantAnswer } from './plant-advice.mock.js'
import { mockTerrainAdvice, type AiAdvice } from './terrain-advice.mock.js'

/**
 * Point d'entrée UNIQUE vers le LLM pour tous les modules.
 * - Sans LLM_API_KEY : réponses simulées réalistes (la démo marche toujours, même hors ligne).
 * - Le branchement du vrai LLM se fera ici, sans toucher aux modules qui l'utilisent.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)

  constructor(private readonly config: ConfigService) {}

  get hasApiKey(): boolean {
    return Boolean(this.config.get<string>('LLM_API_KEY'))
  }

  /** Explique une estimation TerraCalc et donne des conseils (les chiffres viennent du moteur). */
  async terrainAdvice(estimate: Estimate, species: SpeciesRef): Promise<AiAdvice> {
    if (this.hasApiKey) {
      // L'appel au vrai LLM n'est pas encore branché : on le signale clairement dans les logs
      this.logger.warn('LLM_API_KEY présente mais le connecteur LLM arrive plus tard : réponse simulée utilisée.')
    }
    return mockTerrainAdvice(estimate, species)
  }

  /** PlantDoc : conseil de traitement en langage simple (la maladie vient du modèle de vision) */
  async plantAdvice(disease: DiseaseInfo, severity: string, parcel: string) {
    this.warnIfKeyUnused()
    return { ...mockPlantAdvice(disease, severity, parcel), source: 'mock' as const }
  }

  /** PlantDoc : réponse à une question posée sur un diagnostic (écrite ou dictée) */
  async plantAnswer(disease: DiseaseInfo, question: string) {
    this.warnIfKeyUnused()
    return { answer: mockPlantAnswer(disease, question), source: 'mock' as const }
  }

  /** FactureIA : explication simple de la facture + conseils (montants calculés par le moteur) */
  async invoiceAdvice(invoice: InvoiceData, analysis: InvoiceAnalysis) {
    this.warnIfKeyUnused()
    return { ...mockInvoiceAdvice(invoice, analysis), source: 'mock' as const }
  }

  /** HydroMap : synthèse d'une zone pour les décideurs (indices et prévision calculés par le moteur) */
  async hydroZoneSummary(zone: ZoneProps & { stress: number; level: StressLevel }, f: { trend: string; slopePerMonth: number; in30: number }) {
    this.warnIfKeyUnused()
    return mockZoneSummary(zone, f)
  }

  /** HydroMap : synthèse de l'ensemble du territoire */
  async hydroOverview(counts: Record<StressLevel, number>, worst: { name: string; stress: number }[], total: number) {
    this.warnIfKeyUnused()
    return mockHydroOverview(counts, worst, total)
  }

  /** Assistant flottant : répond à partir des données réelles de l'application */
  async assistantReply(question: string, lang: 'fr' | 'en' | 'ar', context: Awaited<ReturnType<DashboardService['summary']>>, _page?: string) {
    this.warnIfKeyUnused()
    return mockAssistant(question, lang, context)
  }

  private warnIfKeyUnused() {
    if (this.hasApiKey) this.logger.warn('LLM_API_KEY présente mais le connecteur LLM arrive plus tard : réponse simulée utilisée.')
  }
}
