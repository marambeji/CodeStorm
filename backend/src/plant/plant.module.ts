import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import type { PlantDiagnosis } from '../generated/prisma/client.js'
import { AiService } from '../ai/ai.service.js'
import { publicUrl, removeUpload, uploadOptions } from '../common/upload.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { CROPS, DISEASES, severityFromRatio } from './diseases.data.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export const STATUSES = ['a-traiter', 'en-cours', 'traite'] as const

// ─────────────────────────────── DTO ───────────────────────────────

/** Champs envoyés avec la photo (formulaire multipart : tout arrive en texte, d'où @Type) */
export class DiagnoseDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Le nom de la parcelle doit faire entre 2 et 40 caractères.' })
  parcel!: string

  @IsIn(CROPS.map((c) => c.id), { message: 'Culture inconnue.' })
  crop!: string

  @IsString()
  diseaseKey!: string

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number

  /** Part de la feuille atteinte, estimée par l'analyse d'image (0 → 1) */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  affectedRatio!: number
}

export class UpdateDiagnosisDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Le nom de la parcelle doit faire entre 2 et 40 caractères.' })
  parcel?: string

  @IsOptional()
  @IsIn(STATUSES, { message: 'Statut : à traiter, en cours ou traité.' })
  status?: (typeof STATUSES)[number]

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500, { message: 'La note ne peut pas dépasser 500 caractères.' })
  notes?: string
}

export class AskDto {
  @Transform(trim)
  @IsString()
  @Length(3, 300, { message: 'Posez une question de 3 à 300 caractères.' })
  question!: string
}

// ─────────────────────────────── Service ───────────────────────────────

@Injectable()
export class PlantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  disease(key: string) {
    const d = DISEASES.find((x) => x.key === key)
    if (!d) throw new BadRequestException(`Maladie « ${key} » inconnue de la base PlantDoc.`)
    return d
  }

  async diagnose(dto: DiagnoseDto, file?: Express.Multer.File) {
    const d = this.disease(dto.diseaseKey)
    if (d.crop !== dto.crop) throw new BadRequestException(`« ${d.name} » ne concerne pas cette culture.`)
    // La gravité est calculée par le code (surface atteinte), le LLM ne fait que conseiller
    const severity = severityFromRatio(d.healthy, dto.affectedRatio)
    const ai = await this.ai.plantAdvice(d, severity, dto.parcel)
    const row = await this.prisma.plantDiagnosis.create({
      data: {
        parcel: dto.parcel,
        crop: dto.crop,
        diseaseKey: d.key,
        disease: d.name,
        confidence: dto.confidence,
        severity,
        advice: ai.advice,
        tips: JSON.stringify(ai.tips),
        status: d.healthy ? 'traite' : 'a-traiter',
        imageUrl: file ? publicUrl('plant', file.filename) : null,
      },
    })
    return this.serialize(row)
  }

  async history(parcel?: string, crop?: string) {
    const rows = await this.prisma.plantDiagnosis.findMany({
      where: { ...(parcel ? { parcel } : {}), ...(crop ? { crop } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.serialize(r))
  }

  async parcels() {
    const groups = await this.prisma.plantDiagnosis.groupBy({ by: ['parcel'], _count: { _all: true }, orderBy: { parcel: 'asc' } })
    return groups.map((g) => ({ parcel: g.parcel, count: g._count._all }))
  }

  async findOne(id: string) {
    const row = await this.prisma.plantDiagnosis.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Ce diagnostic n’existe pas ou a été supprimé.')
    return this.serialize(row)
  }

  async update(id: string, dto: UpdateDiagnosisDto) {
    await this.findOne(id)
    return this.serialize(await this.prisma.plantDiagnosis.update({ where: { id }, data: dto }))
  }

  async remove(id: string) {
    const row = await this.findOne(id)
    await this.prisma.plantDiagnosis.delete({ where: { id } })
    removeUpload(row.imageUrl)
    return { id, deleted: true }
  }

  async ask(id: string, question: string) {
    const row = await this.findOne(id)
    return this.ai.plantAnswer(this.disease(row.diseaseKey), question)
  }

  private serialize(r: PlantDiagnosis) {
    const d = DISEASES.find((x) => x.key === r.diseaseKey)
    return { ...r, tips: JSON.parse(r.tips) as string[], info: d ?? null }
  }
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * PlantDoc
 *   GET    /api/plant/catalog       cultures + maladies connues (étiquettes du modèle)
 *   POST   /api/plant/diagnose      photo + résultat du modèle → diagnostic enregistré
 *   GET    /api/plant/history       historique (?parcel=&crop=)
 *   GET    /api/plant/parcels       parcelles et nombre de diagnostics
 *   GET    /api/plant/:id           détail
 *   PATCH  /api/plant/:id           parcelle, statut, notes
 *   DELETE /api/plant/:id           suppression (photo comprise)
 *   POST   /api/plant/:id/ask       question à l'IA sur ce diagnostic
 */
@Controller('plant')
export class PlantController {
  constructor(private readonly plant: PlantService) {}

  @Get('catalog')
  catalog() {
    return { crops: CROPS, diseases: DISEASES }
  }

  @Post('diagnose')
  @UseInterceptors(FileInterceptor('image', uploadOptions('plant', 'image', 8)))
  diagnose(@Body() dto: DiagnoseDto, @UploadedFile() file?: Express.Multer.File) {
    return this.plant.diagnose(dto, file)
  }

  @Get('history')
  history(@Query('parcel') parcel?: string, @Query('crop') crop?: string) {
    return this.plant.history(parcel, crop)
  }

  @Get('parcels')
  parcels() {
    return this.plant.parcels()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.plant.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDiagnosisDto) {
    return this.plant.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.plant.remove(id)
  }

  @Post(':id/ask')
  @HttpCode(200)
  ask(@Param('id') id: string, @Body() dto: AskDto) {
    return this.plant.ask(id, dto.question)
  }
}

@Module({ controllers: [PlantController], providers: [PlantService] })
export class PlantModule {}
