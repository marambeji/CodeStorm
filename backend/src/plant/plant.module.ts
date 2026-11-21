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
  ServiceUnavailableException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { readFile } from 'node:fs/promises'
import { Public } from '@nestjs/authentication'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import type { PlantDiagnosis } from '../generated/prisma/client.js'
import { AiService } from '../ai/ai.service.js'
import { publicUrl, removeUpload, uploadOptions } from '../common/upload.js'
import { CurrentUserId } from '../auth/auth.module.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { CROPS, DISEASES, severityFromRatio, type DiseaseInfo } from './diseases.data.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
export const STATUSES = ['a-traiter', 'en-cours', 'traite'] as const

// ─────────────────────────────── DTO ───────────────────────────────

/** Champs envoyés avec la photo (formulaire multipart : tout arrive en texte, d'où @Type) */
export class DiagnoseDto {
  /** Facultatif : par défaut, le diagnostic est rangé sous le nom de la culture détectée */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 40, { message: 'Le nom de la parcelle ne peut pas dépasser 40 caractères.' })
  parcel?: string

  /** Facultatif : culture indiquée par l'utilisateur (sinon détectée par l'IA) */
  @IsOptional()
  @IsString()
  crop?: string

  // Résultat du modèle local (secours si l'IA ne répond pas)
  @IsOptional()
  @IsString()
  diseaseKey?: string

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number

  /** Part de la feuille atteinte, estimée par l'analyse d'image (0 → 1) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  affectedRatio?: number
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
    private readonly userId: CurrentUserId,
  ) {}

  disease(key: string) {
    const d = DISEASES.find((x) => x.key === key)
    if (!d) throw new BadRequestException(`Maladie « ${key} » inconnue de la base PlantDoc.`)
    return d
  }

  async diagnose(dto: DiagnoseDto, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Ajoutez une photo de la feuille.')
    const cropHint = dto.crop ? (CROPS.find((c) => c.id === dto.crop)?.name ?? dto.crop) : null
    const vision = await this.ai.diagnoseLeaf(await readFile(file.path), file.mimetype, cropHint, DISEASES)

    let info: DiseaseInfo
    let confidence: number
    let affectedRatio: number
    let details: Record<string, unknown>
    if (vision) {
      if (!vision.isPlant) {
        removeUpload(publicUrl('plant', file.filename))
        throw new BadRequestException('Cette photo ne semble pas montrer une plante. Photographiez une feuille, de près et bien éclairée.')
      }
      const known = DISEASES.find((d) => d.key === vision.diseaseKey)
      const cropId = known?.crop ?? CROPS.find((c) => c.name.toLowerCase() === vision.crop.toLowerCase())?.id ?? vision.crop.toLowerCase()
      info = known ?? {
        key: vision.healthy ? `${cropId}-sain` : 'autre',
        crop: cropId,
        name: vision.healthy ? 'Plante saine' : vision.diseaseName,
        healthy: vision.healthy,
        agent: (['champignon', 'bactérie', 'virus'].includes(vision.agent) ? vision.agent : 'aucun') as DiseaseInfo['agent'],
        symptoms: vision.symptomsSeen,
        treatment: vision.treatment,
        organic: vision.organic,
        prevention: vision.prevention,
        contagious: vision.contagious,
      }
      confidence = vision.confidence
      affectedRatio = vision.healthy ? 0 : vision.affectedRatio
      details = { engine: 'gemini', cropName: vision.crop, agent: vision.agent, symptomsSeen: vision.symptomsSeen, affectedRatio, alternatives: vision.alternatives, info: known ? null : info }
    } else {
      // Secours : résultat du modèle local envoyé par le navigateur
      if (!dto.diseaseKey || dto.confidence === undefined || dto.affectedRatio === undefined) {
        removeUpload(publicUrl('plant', file.filename))
        throw new ServiceUnavailableException('L’IA ne répond pas et aucune analyse locale n’a été fournie. Réessayez.')
      }
      info = this.disease(dto.diseaseKey)
      confidence = dto.confidence
      affectedRatio = dto.affectedRatio
      details = { engine: 'local', cropName: CROPS.find((c) => c.id === info.crop)?.name ?? info.crop, affectedRatio, alternatives: [], info: null }
    }

    // La gravité est calculée par le code (surface atteinte), le LLM ne fait que conseiller
    const severity = severityFromRatio(info.healthy, affectedRatio)
    const parcel = dto.parcel?.trim() || String(details.cropName)
    const ai = await this.ai.plantAdvice(info, severity, parcel, vision?.symptomsSeen)
    const row = await this.prisma.plantDiagnosis.create({
      data: {
        userId: this.userId.get(),
        parcel,
        crop: info.crop,
        diseaseKey: info.key,
        disease: info.name,
        confidence,
        severity,
        advice: ai.advice,
        tips: JSON.stringify(ai.tips),
        status: info.healthy ? 'traite' : 'a-traiter',
        imageUrl: publicUrl('plant', file.filename),
        details: JSON.stringify(details),
      },
    })
    return this.serialize(row)
  }

  async history(parcel?: string, crop?: string) {
    const rows = await this.prisma.plantDiagnosis.findMany({
      where: { userId: this.userId.get(), ...(parcel ? { parcel } : {}), ...(crop ? { crop } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map((r) => this.serialize(r))
  }

  async parcels() {
    const groups = await this.prisma.plantDiagnosis.groupBy({ by: ['parcel'], where: { userId: this.userId.get() }, _count: { _all: true }, orderBy: { parcel: 'asc' } })
    return groups.map((g) => ({ parcel: g.parcel, count: g._count._all }))
  }

  async findOne(id: string) {
    const row = await this.prisma.plantDiagnosis.findFirst({ where: { id, userId: this.userId.get() } })
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
    if (!row.info) throw new BadRequestException('Fiche de maladie introuvable pour ce diagnostic.')
    return this.ai.plantAnswer(row.info, question)
  }

  private serialize(r: PlantDiagnosis) {
    const details = r.details ? (JSON.parse(r.details) as { info: DiseaseInfo | null; [k: string]: unknown }) : null
    const d = DISEASES.find((x) => x.key === r.diseaseKey) ?? details?.info ?? null
    return { ...r, tips: JSON.parse(r.tips) as string[], info: d, details }
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

  @Public()
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
