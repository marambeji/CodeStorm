import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { Terrain } from '../generated/prisma/client.js'
import { AiService } from '../ai/ai.service.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { estimate, InvalidPolygonError, measurePolygon, validatePolygon, type Irrigation } from './estimation.js'
import type { CreateTerrainDto, EstimateTerrainDto, UpdateTerrainDto } from './terrain.dto.js'

export const DISCLAIMER =
  'Estimation indicative, calculée à partir de moyennes agronomiques. Les résultats réels dépendent de la variété, du sol, du climat et de la conduite.'

@Injectable()
export class TerrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  /**
   * Calcule une estimation complète (sans l'enregistrer) :
   * 1. chiffres par le moteur déterministe, 2. explication et conseils par l'IA.
   */
  async estimate(dto: EstimateTerrainDto) {
    const polygon = this.parsePolygon(dto.polygon)
    const species = await this.prisma.species.findUnique({ where: { id: dto.speciesId } })
    if (!species) throw new BadRequestException(`Espèce « ${dto.speciesId} » inconnue.`)

    const result = estimate({
      polygon,
      species,
      plantingYear: dto.plantingYear ?? null,
      rowSpacingM: dto.rowSpacingM,
      treeSpacingM: dto.treeSpacingM,
      irrigation: dto.irrigation,
      pricePerKg: dto.pricePerKg,
      currentYear: new Date().getFullYear(),
    })
    const ai = await this.ai.terrainAdvice(result, species)
    return { ...result, ai, disclaimer: DISCLAIMER, computedAt: new Date().toISOString() }
  }

  async findAll() {
    const rows = await this.prisma.terrain.findMany({ orderBy: { updatedAt: 'desc' }, include: { species: { select: { id: true, name: true } } } })
    return rows.map((t) => this.serialize(t))
  }

  async findOne(id: string) {
    const t = await this.prisma.terrain.findUnique({ where: { id }, include: { species: { select: { id: true, name: true } } } })
    if (!t) throw new NotFoundException('Ce terrain n’existe pas ou a été supprimé.')
    return this.serialize(t)
  }

  async create(dto: CreateTerrainDto) {
    const data = await this.buildData(dto)
    const t = await this.prisma.terrain.create({ data: { name: dto.name, ...data }, include: { species: { select: { id: true, name: true } } } })
    return this.serialize(t)
  }

  async update(id: string, dto: UpdateTerrainDto) {
    const current = await this.findOne(id)
    // On fusionne l'existant et les changements, puis on recalcule tout
    const merged: CreateTerrainDto = {
      name: dto.name ?? current.name,
      polygon: dto.polygon ?? (current.polygon as Record<string, unknown>),
      speciesId: dto.speciesId ?? current.speciesId ?? '',
      plantingYear: dto.plantingYear !== undefined ? dto.plantingYear : current.plantingYear,
      rowSpacingM: dto.rowSpacingM !== undefined ? dto.rowSpacingM : current.rowSpacingM,
      treeSpacingM: dto.treeSpacingM !== undefined ? dto.treeSpacingM : current.treeSpacingM,
      irrigation: (dto.irrigation ?? current.irrigation ?? 'goutte-a-goutte') as Irrigation,
      pricePerKg: dto.pricePerKg !== undefined ? dto.pricePerKg : current.pricePerKg,
    }
    const data = await this.buildData(merged)
    const t = await this.prisma.terrain.update({
      where: { id },
      data: { name: merged.name, ...data },
      include: { species: { select: { id: true, name: true } } },
    })
    return this.serialize(t)
  }

  async remove(id: string) {
    await this.findOne(id) // 404 propre si l'id n'existe pas
    await this.prisma.terrain.delete({ where: { id } })
    return { id, deleted: true }
  }

  // ───────────────────────────── interne ─────────────────────────────

  private parsePolygon(input: unknown) {
    try {
      return validatePolygon(input)
    } catch (e) {
      if (e instanceof InvalidPolygonError) throw new BadRequestException(e.message)
      throw e
    }
  }

  /** Géométrie + estimation prêtes à enregistrer */
  private async buildData(dto: CreateTerrainDto) {
    const polygon = this.parsePolygon(dto.polygon)
    const m = measurePolygon(polygon)
    const full = await this.estimate({ ...dto, polygon: polygon as unknown as Record<string, unknown> })
    // On n'enregistre pas les milliers de points de l'aperçu : ils se recalculent à l'ouverture
    const stored = { ...full, trees: full.trees ? { ...full.trees, points: [] } : null }
    return {
      polygon: JSON.stringify(polygon),
      areaM2: m.areaM2,
      perimeterM: m.perimeterM,
      centroidLat: m.centroid[0],
      centroidLng: m.centroid[1],
      speciesId: dto.speciesId,
      plantingYear: dto.plantingYear ?? null,
      rowSpacingM: dto.rowSpacingM ?? null,
      treeSpacingM: dto.treeSpacingM ?? null,
      irrigation: dto.irrigation,
      pricePerKg: dto.pricePerKg ?? null,
      estimate: JSON.stringify(stored),
    }
  }

  private serialize(t: Terrain & { species: { id: string; name: string } | null }) {
    return {
      ...t,
      polygon: JSON.parse(t.polygon) as unknown,
      estimate: t.estimate ? (JSON.parse(t.estimate) as unknown) : null,
    }
  }
}
