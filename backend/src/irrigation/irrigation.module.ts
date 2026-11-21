import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Logger, Module, NotFoundException, Param, Patch, Post } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator'
import type { IrrigationPlan } from '../generated/prisma/client.js'
import { AiService } from '../ai/ai.service.js'
import { CurrentUserId } from '../auth/auth.module.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { buildPlan, seasonalWeather, type DayWeather, type Irrigation } from './irrigation.engine.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const IRRIGATIONS: Irrigation[] = ['goutte-a-goutte', 'aspersion', 'gravitaire']

// ─────────────────────────────── DTO ───────────────────────────────

export class PlanInputDto {
  @IsOptional()
  @IsString()
  terrainId?: string

  @IsString()
  speciesId!: string

  @IsNumber()
  @Min(50, { message: 'La surface doit faire au moins 50 m².' })
  @Max(50_000_000)
  areaM2!: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5_000_000)
  trees?: number | null

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number

  @IsIn(IRRIGATIONS, { message: 'Irrigation : goutte-à-goutte, aspersion ou gravitaire.' })
  irrigation!: Irrigation

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  plantingYear?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'La hauteur de pompage ne peut pas être négative.' })
  @Max(500)
  pumpHeadM?: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  kwhPrice?: number
}

export class SavePlanDto extends PlanInputDto {
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Le nom doit faire entre 2 et 60 caractères.' })
  name!: string
}

export class DayDoneDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date au format AAAA-MM-JJ.' })
  date!: string

  @IsBoolean()
  done!: boolean
}

export class AskDto {
  @Transform(trim)
  @IsString()
  @Length(3, 300, { message: 'Posez une question de 3 à 300 caractères.' })
  question!: string
}

// ─────────────────────────────── Service ───────────────────────────────

@Injectable()
export class IrrigationService {
  private readonly logger = new Logger(IrrigationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly userId: CurrentUserId,
  ) {}

  /** Météo réelle 7 jours (Open-Meteo, gratuit, sans clé) ; sinon normales saisonnières */
  private async weather(lat: number, lng: number): Promise<{ days: DayWeather[]; source: 'open-meteo' | 'saisonnier' }> {
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        '&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7'
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const d = (await res.json()) as { daily: { time: string[]; et0_fao_evapotranspiration: number[]; precipitation_sum: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] } }
      return {
        source: 'open-meteo',
        days: d.daily.time.map((date, i) => ({
          date,
          et0: d.daily.et0_fao_evapotranspiration[i] ?? 0,
          rain: d.daily.precipitation_sum[i] ?? 0,
          tMax: d.daily.temperature_2m_max[i],
          tMin: d.daily.temperature_2m_min[i],
        })),
      }
    } catch (e) {
      this.logger.warn(`Météo indisponible (${(e as Error).message}) : normales saisonnières utilisées.`)
      return { source: 'saisonnier', days: seasonalWeather(new Date()) }
    }
  }

  /** Calcule le plan (sans l'enregistrer) + l'explication de l'IA */
  async compute(dto: PlanInputDto) {
    const species = await this.prisma.species.findUnique({ where: { id: dto.speciesId } })
    if (!species) throw new BadRequestException(`Culture « ${dto.speciesId} » inconnue.`)
    const isTree = species.kind === 'tree'
    if (isTree && !dto.trees) throw new BadRequestException('Indiquez le nombre d’arbres.')
    const weather = await this.weather(dto.lat, dto.lng)
    const age = dto.plantingYear ? new Date().getFullYear() - dto.plantingYear : null
    const habit = isTree ? (species.waterM3PerTreeYear ?? 0) * (dto.trees ?? 0) : ((species.waterM3PerHaYear ?? 0) * dto.areaM2) / 10_000
    const plan = buildPlan({
      speciesId: species.id,
      kind: isTree ? 'tree' : 'crop',
      areaM2: dto.areaM2,
      trees: isTree ? (dto.trees ?? null) : null,
      age,
      fullProductionAge: species.fullProductionAge,
      irrigation: dto.irrigation,
      pumpHeadM: dto.pumpHeadM ?? 30,
      kwhPrice: dto.kwhPrice ?? 0.25,
      habitWaterM3PerYear: habit,
      weather: weather.days,
    })
    const ai = await this.ai.irrigationAdvice(plan, { species: species.name, areaHa: dto.areaM2 / 10_000, trees: dto.trees ?? null, irrigation: dto.irrigation, age })
    return { ...plan, species: { id: species.id, name: species.name }, weatherSource: weather.source, ai, computedAt: new Date().toISOString() }
  }

  async create(dto: SavePlanDto) {
    const { name, ...input } = dto
    // Un plan ne peut être rattaché qu'à un terrain de l'agriculteur connecté
    if (input.terrainId && !(await this.prisma.terrain.findFirst({ where: { id: input.terrainId, userId: this.userId.get() } }))) {
      throw new BadRequestException('Ce terrain n’existe pas dans votre compte.')
    }
    const plan = await this.compute(input)
    const row = await this.prisma.irrigationPlan.create({
      data: {
        userId: this.userId.get(),
        name,
        terrainId: input.terrainId ?? null,
        speciesId: input.speciesId,
        areaM2: input.areaM2,
        trees: input.trees ?? null,
        lat: input.lat,
        lng: input.lng,
        irrigation: input.irrigation,
        plantingYear: input.plantingYear ?? null,
        pumpHeadM: input.pumpHeadM ?? 30,
        kwhPrice: input.kwhPrice ?? 0.25,
        plan: JSON.stringify(plan),
      },
    })
    return this.serialize(row)
  }

  async findAll() {
    const rows = await this.prisma.irrigationPlan.findMany({ where: { userId: this.userId.get() }, orderBy: { updatedAt: 'desc' } })
    return rows.map((r) => this.serialize(r))
  }

  async findOne(id: string) {
    const row = await this.prisma.irrigationPlan.findFirst({ where: { id, userId: this.userId.get() } })
    if (!row) throw new NotFoundException('Ce plan n’existe pas ou a été supprimé.')
    return this.serialize(row)
  }

  /** Recalcule le plan avec la météo du jour (les jours déjà faits sont conservés) */
  async refresh(id: string) {
    const r = await this.findOne(id)
    const plan = await this.compute({
      terrainId: r.terrainId ?? undefined,
      speciesId: r.speciesId,
      areaM2: r.areaM2,
      trees: r.trees,
      lat: r.lat,
      lng: r.lng,
      irrigation: r.irrigation as Irrigation,
      plantingYear: r.plantingYear,
      pumpHeadM: r.pumpHeadM,
      kwhPrice: r.kwhPrice,
    })
    return this.serialize(await this.prisma.irrigationPlan.update({ where: { id }, data: { plan: JSON.stringify(plan) } }))
  }

  async setDay(id: string, dto: DayDoneDto) {
    const r = await this.findOne(id)
    const done = new Set(r.doneDays)
    if (dto.done) done.add(dto.date)
    else done.delete(dto.date)
    return this.serialize(await this.prisma.irrigationPlan.update({ where: { id }, data: { doneDays: JSON.stringify([...done].sort()) } }))
  }

  async remove(id: string) {
    await this.findOne(id)
    await this.prisma.irrigationPlan.delete({ where: { id } })
    return { id, deleted: true }
  }

  async ask(id: string, question: string) {
    const r = await this.findOne(id)
    return this.ai.irrigationAnswer(r.plan, question)
  }

  private serialize(r: IrrigationPlan) {
    return { ...r, plan: JSON.parse(r.plan) as Awaited<ReturnType<IrrigationService['compute']>>, doneDays: JSON.parse(r.doneDays) as string[] }
  }
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * IrriPlan
 *   POST   /api/irrigation/compute        plan 7 jours (aperçu, non enregistré)
 *   GET    /api/irrigation/plans          plans enregistrés
 *   POST   /api/irrigation/plans          enregistrer un plan
 *   GET    /api/irrigation/plans/:id      détail
 *   POST   /api/irrigation/plans/:id/refresh   recalcul avec la météo du jour
 *   PATCH  /api/irrigation/plans/:id/day  marquer un jour comme irrigué
 *   DELETE /api/irrigation/plans/:id      supprimer
 *   POST   /api/irrigation/plans/:id/ask  question à l'IA sur ce plan
 */
@Controller('irrigation')
export class IrrigationController {
  constructor(private readonly irrigation: IrrigationService) {}

  @Post('compute')
  @HttpCode(200)
  compute(@Body() dto: PlanInputDto) {
    return this.irrigation.compute(dto)
  }

  @Get('plans')
  findAll() {
    return this.irrigation.findAll()
  }

  @Post('plans')
  create(@Body() dto: SavePlanDto) {
    return this.irrigation.create(dto)
  }

  @Get('plans/:id')
  findOne(@Param('id') id: string) {
    return this.irrigation.findOne(id)
  }

  @Post('plans/:id/refresh')
  @HttpCode(200)
  refresh(@Param('id') id: string) {
    return this.irrigation.refresh(id)
  }

  @Patch('plans/:id/day')
  setDay(@Param('id') id: string, @Body() dto: DayDoneDto) {
    return this.irrigation.setDay(id, dto)
  }

  @Delete('plans/:id')
  remove(@Param('id') id: string) {
    return this.irrigation.remove(id)
  }

  @Post('plans/:id/ask')
  @HttpCode(200)
  ask(@Param('id') id: string, @Body() dto: AskDto) {
    return this.irrigation.ask(id, dto.question)
  }
}

@Module({ controllers: [IrrigationController], providers: [IrrigationService], exports: [IrrigationService] })
export class IrrigationModule {}
