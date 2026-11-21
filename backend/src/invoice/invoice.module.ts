import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { PartialType } from '@nestjs/mapped-types'
import { FileInterceptor } from '@nestjs/platform-express'
import { Transform, Type } from 'class-transformer'
import { IsDate, IsIn, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import { readFileSync } from 'node:fs'
import { PDFParse } from 'pdf-parse'
import type { Invoice } from '../generated/prisma/client.js'
import { AiService } from '../ai/ai.service.js'
import { publicUrl, removeUpload, uploadOptions } from '../common/upload.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { analyzeInvoice, invoiceLabel, parseInvoiceText, TARIFFS, type InvoiceData } from './invoice.engine.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

// ─────────────────────────────── DTO ───────────────────────────────

/** Saisie ou correction manuelle d'une facture */
export class CreateInvoiceDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Le nom doit faire entre 2 et 60 caractères.' })
  label?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 60)
  supplier?: string

  @Type(() => Date)
  @IsDate({ message: 'Date de début de période invalide.' })
  periodStart!: Date

  @Type(() => Date)
  @IsDate({ message: 'Date de fin de période invalide.' })
  periodEnd!: Date

  @IsNumber({}, { message: 'La consommation (kWh) doit être un nombre.' })
  @Min(1, { message: 'La consommation doit être d’au moins 1 kWh.' })
  @Max(100_000)
  kwh!: number

  @IsOptional()
  @IsNumber()
  @Min(0)
  hpKwh?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0)
  hcKwh?: number | null

  @IsNumber({}, { message: 'Le montant doit être un nombre.' })
  @Min(1, { message: 'Le montant doit être d’au moins 1 €.' })
  @Max(100_000)
  amount!: number

  @IsOptional()
  @IsIn([3, 6, 9, 12], { message: 'Puissance : 3, 6, 9 ou 12 kVA.' })
  subscriptionKva?: number | null
}

export class UpdateInvoiceDto extends PartialType(CreateInvoiceDto) {}

// ─────────────────────────────── Service ───────────────────────────────

const DAY = 86_400_000

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /** Lit le PDF, extrait les champs, calcule et enregistre. Les champs introuvables sont signalés. */
  async analyze(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Ajoutez une facture au format PDF.')
    let text = ''
    try {
      const parser = new PDFParse({ data: readFileSync(file.path) })
      text = (await parser.getText()).text
      await parser.destroy()
    } catch {
      removeUpload(publicUrl('invoice', file.filename))
      throw new BadRequestException('Ce PDF est illisible (scanné ou protégé ?). Saisissez la facture à la main.')
    }

    const f = parseInvoiceText(text)
    const missing = (['periodStart', 'periodEnd', 'kwh', 'amount'] as const).filter((k) => f[k] === null)
    // Valeurs de repli pour enregistrer quand même : l'utilisateur les corrige ensuite
    const periodEnd = f.periodEnd ?? new Date()
    const data: InvoiceData = {
      periodStart: f.periodStart ?? new Date(periodEnd.getTime() - 60 * DAY),
      periodEnd,
      kwh: f.kwh ?? 1,
      hpKwh: f.hpKwh,
      hcKwh: f.hcKwh,
      amount: f.amount ?? 1,
      subscriptionKva: f.subscriptionKva,
    }
    const row = await this.save(null, data, {
      supplier: f.supplier,
      fileName: file.originalname,
      fileUrl: publicUrl('invoice', file.filename),
      extraction: missing.length === 0 ? 'auto' : 'partielle',
      missing,
    })
    return row
  }

  create(dto: CreateInvoiceDto) {
    return this.save(null, this.toData(dto), { supplier: dto.supplier ?? null, label: dto.label, extraction: 'manuelle', missing: [] })
  }

  async findAll() {
    const rows = await this.prisma.invoice.findMany({ orderBy: { periodEnd: 'asc' } })
    return rows.map((r) => this.serialize(r))
  }

  async findOne(id: string) {
    const row = await this.prisma.invoice.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Cette facture n’existe pas ou a été supprimée.')
    return this.serialize(row)
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const cur = await this.findOne(id)
    const data = this.toData({
      periodStart: dto.periodStart ?? cur.periodStart,
      periodEnd: dto.periodEnd ?? cur.periodEnd,
      kwh: dto.kwh ?? cur.kwh,
      hpKwh: dto.hpKwh !== undefined ? dto.hpKwh : cur.hpKwh,
      hcKwh: dto.hcKwh !== undefined ? dto.hcKwh : cur.hcKwh,
      amount: dto.amount ?? cur.amount,
      subscriptionKva: dto.subscriptionKva !== undefined ? dto.subscriptionKva : cur.subscriptionKva,
    })
    // Une facture corrigée par l'utilisateur n'a plus de champ "à vérifier"
    return this.save(id, data, {
      supplier: dto.supplier !== undefined ? dto.supplier : cur.supplier,
      label: dto.label ?? cur.label,
      fileName: cur.fileName,
      fileUrl: cur.analysis.fileUrl,
      extraction: cur.extraction === 'partielle' ? 'manuelle' : cur.extraction,
      missing: [],
    })
  }

  async remove(id: string) {
    const row = await this.findOne(id)
    await this.prisma.invoice.delete({ where: { id } })
    removeUpload(row.analysis.fileUrl)
    return { id, deleted: true }
  }

  // ─────────────────────────── interne ───────────────────────────

  private toData(dto: Pick<CreateInvoiceDto, 'periodStart' | 'periodEnd' | 'kwh' | 'hpKwh' | 'hcKwh' | 'amount' | 'subscriptionKva'>): InvoiceData {
    if (dto.periodEnd <= dto.periodStart) throw new BadRequestException('La fin de période doit être après le début.')
    const hp = dto.hpKwh ?? null
    const hc = dto.hcKwh ?? null
    if (hp !== null && hc !== null && Math.abs(hp + hc - dto.kwh) > Math.max(2, dto.kwh * 0.02)) {
      throw new BadRequestException(`Heures pleines + heures creuses (${hp + hc} kWh) devraient égaler la consommation totale (${dto.kwh} kWh).`)
    }
    return { periodStart: dto.periodStart, periodEnd: dto.periodEnd, kwh: dto.kwh, hpKwh: hp, hcKwh: hc, amount: dto.amount, subscriptionKva: dto.subscriptionKva ?? null }
  }

  private async save(
    id: string | null,
    data: InvoiceData,
    meta: { supplier: string | null; label?: string; fileName?: string | null; fileUrl?: string | null; extraction: string; missing: string[] },
  ) {
    // Facture précédente (pour comparer la consommation par jour)
    const prevRow = await this.prisma.invoice.findFirst({
      where: { periodEnd: { lt: data.periodStart }, ...(id ? { id: { not: id } } : {}) },
      orderBy: { periodEnd: 'desc' },
    })
    const analysis = analyzeInvoice(data, prevRow)
    const ai = await this.ai.invoiceAdvice(data, analysis)
    const label = meta.label ?? invoiceLabel(data.periodEnd)
    const fields = {
      label,
      supplier: meta.supplier,
      ...data,
      offer: analysis.offer,
      tiers: JSON.stringify({ ...analysis, fileUrl: meta.fileUrl ?? null, missing: meta.missing }),
      explanation: ai.explanation,
      tips: JSON.stringify(ai.tips),
      extraction: meta.extraction,
      fileName: meta.fileName ?? null,
    }
    const row = id ? await this.prisma.invoice.update({ where: { id }, data: fields }) : await this.prisma.invoice.create({ data: fields })
    return this.serialize(row)
  }

  private serialize(r: Invoice) {
    const { tiers, tips, ...rest } = r
    const analysis = JSON.parse(tiers) as ReturnType<typeof analyzeInvoice> & { fileUrl: string | null; missing: string[] }
    return { ...rest, analysis, tips: JSON.parse(tips) as string[] }
  }
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * FactureIA
 *   GET    /api/invoice/tariffs   tarifs de référence (utilisés aussi par le simulateur)
 *   POST   /api/invoice/analyze   envoi d'un PDF → lecture, calculs, explication
 *   POST   /api/invoice           saisie manuelle
 *   GET    /api/invoice           historique (du plus ancien au plus récent)
 *   GET    /api/invoice/:id       détail
 *   PATCH  /api/invoice/:id       correction (recalcule tout)
 *   DELETE /api/invoice/:id       suppression (PDF compris)
 */
@Controller('invoice')
export class InvoiceController {
  constructor(private readonly invoices: InvoiceService) {}

  @Get('tariffs')
  tariffs() {
    return TARIFFS
  }

  @Post('analyze')
  @UseInterceptors(FileInterceptor('file', uploadOptions('invoice', 'pdf', 10)))
  analyze(@UploadedFile() file?: Express.Multer.File) {
    return this.invoices.analyze(file)
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto)
  }

  @Get()
  findAll() {
    return this.invoices.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.invoices.remove(id)
  }
}

@Module({ controllers: [InvoiceController], providers: [InvoiceService] })
export class InvoiceModule {}
