import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common'
import { PartialType } from '@nestjs/mapped-types'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import { IsDate, IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxDate, Min } from 'class-validator'
import { memoryStorage } from 'multer'
import { AiService } from '../ai/ai.service.js'
import { publicUrl, removeUpload, uploadOptions } from '../common/upload.js'
import { CurrentUserId } from '../auth/auth.module.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { analyzeReadings, checkIndexConsistency, LEAK_RULE } from './consumption.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

// ─────────────────────────────── DTO ───────────────────────────────

export class CreateMeterDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Le nom du compteur doit faire entre 2 et 40 caractères.' })
  name!: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 60)
  location?: string
}
export class UpdateMeterDto extends PartialType(CreateMeterDto) {}

/** Relevé (formulaire multipart possible avec la photo : d'où les @Type) */
export class CreateReadingDto {
  @IsString()
  meterId!: string

  @Type(() => Number)
  @IsNumber({}, { message: 'L’index doit être un nombre (en m³).' })
  @Min(0, { message: 'L’index ne peut pas être négatif.' })
  @Max(9_999_999)
  value!: number

  @Type(() => Date)
  @IsDate({ message: 'Date du relevé invalide.' })
  @MaxDate(() => new Date(Date.now() + 60_000), { message: 'La date du relevé ne peut pas être dans le futur.' })
  readAt!: Date

  @IsOptional()
  @IsIn(['ocr', 'manuel'])
  source?: 'ocr' | 'manuel'

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  ocrConfidence?: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 200, { message: 'La note ne peut pas dépasser 200 caractères.' })
  note?: string
}

export class UpdateReadingDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'L’index doit être un nombre (en m³).' })
  @Min(0)
  @Max(9_999_999)
  value?: number

  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Date du relevé invalide.' })
  @MaxDate(() => new Date(Date.now() + 60_000), { message: 'La date du relevé ne peut pas être dans le futur.' })
  readAt?: Date

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 200)
  note?: string
}

// ─────────────────────────────── Service ───────────────────────────────

@Injectable()
export class MeterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userId: CurrentUserId,
  ) {}

  async meters() {
    const meters = await this.prisma.meter.findMany({ where: { userId: this.userId.get() }, orderBy: { createdAt: 'asc' }, include: { readings: true } })
    return meters.map(({ readings, ...m }) => ({ ...m, ...analyzeReadings(readings).stats }))
  }

  createMeter(dto: CreateMeterDto) {
    return this.prisma.meter.create({ data: { ...dto, userId: this.userId.get() } })
  }

  async updateMeter(id: string, dto: UpdateMeterDto) {
    await this.meter(id)
    return this.prisma.meter.update({ where: { id }, data: dto })
  }

  async removeMeter(id: string) {
    const m = await this.prisma.meter.findFirst({ where: { id, userId: this.userId.get() }, include: { readings: true } })
    if (!m) throw new NotFoundException('Ce compteur n’existe pas.')
    await this.prisma.meter.delete({ where: { id } }) // les relevés suivent (onDelete: Cascade)
    m.readings.forEach((r) => removeUpload(r.photoUrl)) // et leurs photos
    return { id, deleted: true }
  }

  /** Historique d'un compteur : relevés + consommations + alerte de fuite + conseil */
  async history(meterId: string) {
    const meter = await this.meter(meterId)
    const readings = await this.prisma.meterReading.findMany({ where: { meterId }, orderBy: { readAt: 'asc' } })
    const analysis = analyzeReadings(readings)
    return { meter, readings, ...analysis, rule: LEAK_RULE, advice: advice(analysis.stats) }
  }

  async createReading(dto: CreateReadingDto, file?: Express.Multer.File) {
    await this.meter(dto.meterId)
    const existing = await this.prisma.meterReading.findMany({ where: { meterId: dto.meterId } })
    const error = checkIndexConsistency(existing, dto.value, dto.readAt)
    if (error) {
      if (file) removeUpload(publicUrl('meter', file.filename))
      throw new BadRequestException(error)
    }
    return this.prisma.meterReading.create({
      data: {
        meterId: dto.meterId,
        value: dto.value,
        readAt: dto.readAt,
        source: dto.source ?? (file ? 'ocr' : 'manuel'),
        ocrConfidence: dto.ocrConfidence ?? null,
        note: dto.note || null,
        photoUrl: file ? publicUrl('meter', file.filename) : null,
      },
    })
  }

  async updateReading(id: string, dto: UpdateReadingDto) {
    const r = await this.reading(id)
    const existing = await this.prisma.meterReading.findMany({ where: { meterId: r.meterId } })
    const error = checkIndexConsistency(existing, dto.value ?? r.value, dto.readAt ?? r.readAt, id)
    if (error) throw new BadRequestException(error)
    // Une valeur corrigée à la main n'est plus une lecture automatique
    return this.prisma.meterReading.update({ where: { id }, data: { ...dto, ...(dto.value !== undefined && dto.value !== r.value ? { source: 'manuel' } : {}) } })
  }

  async removeReading(id: string) {
    const r = await this.reading(id)
    await this.prisma.meterReading.delete({ where: { id } })
    removeUpload(r.photoUrl)
    return { id, deleted: true }
  }

  private async meter(id: string) {
    const m = await this.prisma.meter.findFirst({ where: { id, userId: this.userId.get() } })
    if (!m) throw new NotFoundException('Ce compteur n’existe pas.')
    return m
  }
  private async reading(id: string) {
    const r = await this.prisma.meterReading.findFirst({ where: { id, meter: { userId: this.userId.get() } } })
    if (!r) throw new NotFoundException('Ce relevé n’existe pas ou a été supprimé.')
    return r
  }
}

/** Conseil déterministe selon l'état du compteur (texte simple, sans LLM) */
function advice(s: ReturnType<typeof analyzeReadings>['stats']) {
  const nf = (n: number) => n.toLocaleString('fr-FR').replace(/ /g, ' ')
  if (s.readings < 2) return 'Ajoutez au moins deux relevés pour calculer votre consommation.'
  if (s.leakAlert)
    return (
      `Fuite possible : ${nf(s.lastLitersPerDay ?? 0)} L/jour contre ${nf((s.lastLitersPerDay ?? 0) - s.excessLitersPerDay)} L/jour d’habitude, soit ${nf(s.excessLitersPerDay * 30)} litres en trop par mois. ` +
      'Test simple : fermez tous les robinets, notez l’index, attendez 30 minutes sans utiliser d’eau. Si l’index a bougé, il y a une fuite (chasse d’eau, robinet, tuyau enterré).'
    )
  return `Consommation normale : ${nf(s.usualLitersPerDay ?? 0)} L/jour en moyenne. Un relevé par semaine suffit pour détecter rapidement une fuite.`
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * AquaScan
 *   POST   /api/meter/ocr                lecture de l'index sur une photo (IA vision)
 *   GET    /api/meter/meters             compteurs + état (dernier index, fuite…)
 *   POST   /api/meter/meters             créer un compteur
 *   PATCH  /api/meter/meters/:id         renommer
 *   DELETE /api/meter/meters/:id         supprimer (avec ses relevés)
 *   GET    /api/meter/history?meterId=   relevés + consommations + alerte
 *   POST   /api/meter/reading            nouveau relevé (photo facultative)
 *   PATCH  /api/meter/reading/:id        corriger un relevé
 *   DELETE /api/meter/reading/:id        supprimer un relevé
 */
@Controller('meter')
export class MeterController {
  constructor(
    private readonly meters: MeterService,
    private readonly ai: AiService,
  ) {}

  /** Lecture de l'index par IA (vision). La photo reste en mémoire : rien n'est enregistré. */
  @Post('ocr')
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(file.mimetype.startsWith('image/') ? null : new BadRequestException('Le fichier doit être une image.'), file.mimetype.startsWith('image/')),
    }),
  )
  ocr(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Ajoutez une photo du compteur.')
    return this.ai.readMeter(file.buffer, file.mimetype)
  }

  @Get('meters')
  list() {
    return this.meters.meters()
  }

  @Post('meters')
  createMeter(@Body() dto: CreateMeterDto) {
    return this.meters.createMeter(dto)
  }

  @Patch('meters/:id')
  updateMeter(@Param('id') id: string, @Body() dto: UpdateMeterDto) {
    return this.meters.updateMeter(id, dto)
  }

  @Delete('meters/:id')
  removeMeter(@Param('id') id: string) {
    return this.meters.removeMeter(id)
  }

  @Get('history')
  history(@Query('meterId') meterId?: string) {
    if (!meterId) throw new BadRequestException('Précisez le compteur : /api/meter/history?meterId=…')
    return this.meters.history(meterId)
  }

  @Post('reading')
  @UseInterceptors(FileInterceptor('photo', uploadOptions('meter', 'image', 8)))
  createReading(@Body() dto: CreateReadingDto, @UploadedFile() file?: Express.Multer.File) {
    return this.meters.createReading(dto, file)
  }

  @Patch('reading/:id')
  updateReading(@Param('id') id: string, @Body() dto: UpdateReadingDto) {
    return this.meters.updateReading(id, dto)
  }

  @Delete('reading/:id')
  removeReading(@Param('id') id: string) {
    return this.meters.removeReading(id)
  }
}

@Module({ controllers: [MeterController], providers: [MeterService] })
export class MeterModule {}
