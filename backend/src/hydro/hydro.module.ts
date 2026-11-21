import { BadRequestException, Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { PartialType } from '@nestjs/mapped-types'
import { Transform, Type } from 'class-transformer'
import { IsDate, IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxDate, Min } from 'class-validator'
import { AiService } from '../ai/ai.service.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { forecast, SimulatedHydroProvider, stressLevel, zonesCollection, type HydroDataProvider, type StressLevel } from './hydro.engine.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export const OBSERVATION_TYPES = ['puits', 'irrigation', 'secheresse', 'autre'] as const

export class CreateObservationDto {
  @IsString()
  zoneId!: string

  @IsIn(OBSERVATION_TYPES, { message: 'Type : puits, irrigation, sécheresse ou autre.' })
  type!: (typeof OBSERVATION_TYPES)[number]

  @Transform(trim)
  @IsString()
  @Length(3, 500, { message: 'La note doit faire entre 3 et 500 caractères.' })
  note!: string

  @IsOptional()
  @IsNumber({}, { message: 'La profondeur doit être un nombre (en mètres).' })
  @Min(0)
  @Max(500)
  waterLevelM?: number | null

  @Type(() => Date)
  @IsDate({ message: 'Date d’observation invalide.' })
  @MaxDate(() => new Date(Date.now() + 86_400_000), { message: 'La date d’observation ne peut pas être dans le futur.' })
  observedAt!: Date
}

export class UpdateObservationDto extends PartialType(CreateObservationDto) {}

@Injectable()
export class HydroService {
  /** Changer de source de données (Sentinel-2, GEE…) = changer cette seule ligne */
  private readonly provider: HydroDataProvider = new SimulatedHydroProvider()

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  zones() {
    return { ...zonesCollection(this.provider), source: this.provider.source }
  }

  private zone(id: string) {
    const z = zonesCollection(this.provider).features.find((f) => f.properties.id === id)
    if (!z) throw new NotFoundException(`Zone « ${id} » inconnue.`)
    return z
  }

  forecast(zoneId: string) {
    this.zone(zoneId)
    const history = this.provider.history(zoneId, 60, new Date())
    const f = forecast(history, 30)
    return { zoneId, history: history.slice(-30), forecast: f.points, trend: f.trend, slopePerMonth: f.slopePerMonth, level: stressLevel(f.points[29].stress) }
  }

  async summary(zoneId: string) {
    const z = this.zone(zoneId)
    const f = this.forecast(zoneId)
    return this.ai.hydroZoneSummary(z.properties, { trend: f.trend, slopePerMonth: f.slopePerMonth, in30: f.forecast[29].stress })
  }

  async overview() {
    const features = zonesCollection(this.provider).features
    const counts: Record<StressLevel, number> = { faible: 0, modéré: 0, élevé: 0, critique: 0 }
    features.forEach((f) => counts[f.properties.level]++)
    const sorted = [...features].sort((a, b) => b.properties.stress - a.properties.stress)
    const worst = sorted.slice(0, 3).map((f) => ({ id: f.properties.id, name: f.properties.name, stress: f.properties.stress, level: f.properties.level }))
    const avg = features.reduce((s, f) => s + f.properties.stress, 0) / features.length
    const ai = await this.ai.hydroOverview(counts, worst, features.length)
    return { counts, worst, averageStress: Math.round(avg * 1000) / 1000, totalAreaHa: features.reduce((s, f) => s + f.properties.areaHa, 0), ai }
  }

  observations(zoneId?: string) {
    return this.prisma.hydroObservation.findMany({ where: zoneId ? { zoneId } : {}, orderBy: { observedAt: 'desc' } })
  }

  createObservation(dto: CreateObservationDto) {
    this.zone(dto.zoneId)
    return this.prisma.hydroObservation.create({ data: dto })
  }

  async updateObservation(id: string, dto: UpdateObservationDto) {
    await this.findObservation(id)
    if (dto.zoneId) this.zone(dto.zoneId)
    return this.prisma.hydroObservation.update({ where: { id }, data: dto })
  }

  async removeObservation(id: string) {
    await this.findObservation(id)
    await this.prisma.hydroObservation.delete({ where: { id } })
    return { id, deleted: true }
  }

  private async findObservation(id: string) {
    const o = await this.prisma.hydroObservation.findUnique({ where: { id } })
    if (!o) throw new NotFoundException('Cette observation n’existe pas ou a été supprimée.')
    return o
  }
}

/**
 * HydroMap
 *   GET    /api/hydro/zones                   zones + indices + stress (GeoJSON)
 *   GET    /api/hydro/overview                synthèse globale (comptes, zones les plus touchées, IA)
 *   GET    /api/hydro/forecast?zoneId=        historique 30 j + prévision 30 j
 *   GET    /api/hydro/zones/:id/summary       synthèse IA pour les décideurs
 *   GET    /api/hydro/observations?zoneId=    observations de terrain
 *   POST   /api/hydro/observations            créer
 *   PATCH  /api/hydro/observations/:id        modifier
 *   DELETE /api/hydro/observations/:id        supprimer
 */
@Controller('hydro')
export class HydroController {
  constructor(private readonly hydro: HydroService) {}

  @Get('zones')
  zones() {
    return this.hydro.zones()
  }

  @Get('overview')
  overview() {
    return this.hydro.overview()
  }

  @Get('forecast')
  forecast(@Query('zoneId') zoneId?: string) {
    if (!zoneId) throw new BadRequestException('Précisez la zone : /api/hydro/forecast?zoneId=z01')
    return this.hydro.forecast(zoneId)
  }

  @Get('zones/:id/summary')
  summary(@Param('id') id: string) {
    return this.hydro.summary(id)
  }

  @Get('observations')
  observations(@Query('zoneId') zoneId?: string) {
    return this.hydro.observations(zoneId)
  }

  @Post('observations')
  create(@Body() dto: CreateObservationDto) {
    return this.hydro.createObservation(dto)
  }

  @Patch('observations/:id')
  update(@Param('id') id: string, @Body() dto: UpdateObservationDto) {
    return this.hydro.updateObservation(id, dto)
  }

  @Delete('observations/:id')
  remove(@Param('id') id: string) {
    return this.hydro.removeObservation(id)
  }
}

@Module({ controllers: [HydroController], providers: [HydroService] })
export class HydroModule {}
