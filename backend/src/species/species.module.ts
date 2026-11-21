import { Controller, Get, Module, NotFoundException, Param } from '@nestjs/common'
import type { Species } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { yieldFactor } from '../terrain/estimation.js'

/**
 * GET /api/species : catalogue des espèces (données agronomiques de référence).
 * Chaque espèce est enrichie de sa courbe de rendement selon l'âge, calculée par le
 * même moteur que les estimations (une seule source de vérité).
 */
@Controller('species')
export class SpeciesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll() {
    const rows = await this.prisma.species.findMany({ orderBy: [{ kind: 'desc' }, { name: 'asc' }] })
    return rows.map(withYieldCurve)
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const species = await this.prisma.species.findUnique({ where: { id } })
    if (!species) throw new NotFoundException(`Espèce « ${id} » introuvable.`)
    return withYieldCurve(species)
  }
}

/** Rendement d'un arbre (kg/an) à quelques âges clés : jeune → pleine production → vieillesse */
function withYieldCurve(s: Species) {
  if (s.kind !== 'tree' || !s.fullYieldKgPerTree) return { ...s, yieldCurve: [] }
  const first = s.firstProductionAge ?? 1
  const full = s.fullProductionAge ?? first + 1
  const life = s.lifespanYears ?? 50
  const ages = [...new Set([first, Math.round((first + full) / 2), full, Math.round(life * 0.5), life])].sort((a, b) => a - b)
  return {
    ...s,
    yieldCurve: ages.map((age) => ({ age, kg: Math.round(s.fullYieldKgPerTree! * yieldFactor(age, s) * 10) / 10 })),
  }
}

@Module({ controllers: [SpeciesController] })
export class SpeciesModule {}
