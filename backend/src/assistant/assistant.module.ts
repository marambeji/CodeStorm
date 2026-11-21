import { Body, Controller, HttpCode, Injectable, Logger, Module, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, ValidateNested } from 'class-validator'
import { AiService } from '../ai/ai.service.js'
import { DashboardModule, DashboardService } from '../dashboard/dashboard.module.js'
import { CurrentUserId } from '../auth/auth.module.js'
import { PrismaService } from '../prisma/prisma.service.js'

export type Lang = 'fr' | 'en' | 'ar'

class ChatMessage {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant'

  @IsString()
  @Length(1, 2000)
  content!: string
}

export class ChatDto {
  @IsArray()
  @ArrayMaxSize(30, { message: 'Conversation trop longue : commencez-en une nouvelle.' })
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  messages!: ChatMessage[]

  @IsOptional()
  @IsIn(['fr', 'en', 'ar'])
  lang?: Lang

  /** Page sur laquelle se trouve l'utilisateur (pour adapter la réponse) */
  @IsOptional()
  @IsString()
  @Length(0, 100)
  page?: string
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name)

  constructor(
    private readonly dashboard: DashboardService,
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly userId: CurrentUserId,
  ) {}

  async chat(dto: ChatDto) {
    const question = [...dto.messages].reverse().find((m) => m.role === 'user')?.content ?? ''
    // Contexte = données réelles de l'application (mêmes calculs que le tableau de bord) + détails utiles
    const [summary, details] = await Promise.all([this.dashboard.summary(), this.details()])
    return this.ai.assistantReply(question, dto.lang ?? 'fr', summary, dto.page, dto.messages.slice(-12), details)
  }

  /** Détails compacts pour que l'IA réponde précisément (sans tout le JSON brut) */
  private async details() {
    const userId = this.userId.get()
    const [profile, terrains, plans, meters, diagnoses] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.terrain.findMany({ where: { userId }, include: { species: true } }),
      this.prisma.irrigationPlan.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 5 }),
      this.prisma.meter.findMany({ where: { userId }, include: { readings: { orderBy: { readAt: 'desc' }, take: 3 } } }),
      this.prisma.plantDiagnosis.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ])
    const place = profile?.lat != null && profile.lng != null ? { name: profile.placeName, lat: profile.lat, lng: profile.lng } : terrains[0] ? { name: terrains[0].name, lat: terrains[0].centroidLat, lng: terrains[0].centroidLng } : null
    return {
      aujourdhui: new Date().toISOString().slice(0, 10),
      profil: profile ? { nom: profile.name, exploitation: profile.farmName, lieu: profile.placeName } : null,
      meteo: place ? await this.weather(place.lat, place.lng, place.name) : null,
      terrains: terrains.map((t) => {
        const e = t.estimate ? (JSON.parse(t.estimate) as { trees?: { count: number } | null; production?: { kgPerYear: number; kgPerYearFull: number }; water?: { irrigationM3PerYear: number } }) : null
        return { nom: t.name, culture: t.species?.name, hectares: Math.round(t.areaM2 / 100) / 100, plantation: t.plantingYear, irrigation: t.irrigation, arbres: e?.trees?.count, productionKgAn: e?.production?.kgPerYear, productionPleineKgAn: e?.production?.kgPerYearFull, eauM3An: e?.water?.irrigationM3PerYear }
      }),
      plansIrrigation: plans.map((p) => {
        const plan = JSON.parse(p.plan) as { days: { date: string; irrigate: boolean; volumeM3: number; litersPerTree: number | null; durationH: number | null; rain: number; tMax: number; reason: string }[]; totals: unknown; comparison: unknown }
        return { nom: p.name, jours: plan.days.map((d) => ({ date: d.date, arroser: d.irrigate, m3: d.volumeM3, litresParArbre: d.litersPerTree, heures: d.durationH, pluieMm: d.rain, tMax: d.tMax, raison: d.reason })), totaux: plan.totals, comparaison: plan.comparison, joursFaits: JSON.parse(p.doneDays) }
      }),
      compteurs: meters.map((m) => ({ nom: m.name, derniersReleves: m.readings.map((r) => ({ date: r.readAt.toISOString().slice(0, 10), indexM3: r.value })) })),
      diagnostics: diagnoses.map((d) => ({ date: d.createdAt.toISOString().slice(0, 10), parcelle: d.parcel, maladie: d.disease, gravite: d.severity, statut: d.status, confiance: Math.round(d.confidence * 100) })),
    }
  }

  /** Météo des 3 prochains jours (Open-Meteo), null si indisponible */
  private async weather(lat: number, lng: number, name: string | null) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=3`
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!res.ok) return null
      const d = (await res.json()) as { daily: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; wind_speed_10m_max: number[] } }
      return { lieu: name, jours: d.daily.time.map((t, i) => ({ date: t, tMax: d.daily.temperature_2m_max[i], tMin: d.daily.temperature_2m_min[i], pluieMm: d.daily.precipitation_sum[i], ventKmh: d.daily.wind_speed_10m_max[i] })) }
    } catch (e) {
      this.logger.warn(`Météo de l'assistant indisponible : ${(e as Error).message}`)
      return null
    }
  }
}

/** POST /api/assistant/chat : assistant conversationnel (réponse simulée sans clé LLM) */
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Post('chat')
  @HttpCode(200)
  chat(@Body() dto: ChatDto) {
    return this.assistant.chat(dto)
  }
}

@Module({ imports: [DashboardModule], controllers: [AssistantController], providers: [AssistantService] })
export class AssistantModule {}
