import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common'
import { CreateTerrainDto, EstimateTerrainDto, UpdateTerrainDto } from './terrain.dto.js'
import { TerrainService } from './terrain.service.js'

/**
 * TerraCalc : terrains dessinés sur la carte.
 *   POST   /api/terrains/estimate   estimation sans enregistrer (aperçu en direct)
 *   GET    /api/terrains            liste
 *   GET    /api/terrains/:id        détail
 *   POST   /api/terrains            créer (calcule et enregistre l'estimation)
 *   PATCH  /api/terrains/:id        modifier (recalcule l'estimation)
 *   DELETE /api/terrains/:id        supprimer
 */
@Controller('terrains')
export class TerrainController {
  constructor(private readonly terrains: TerrainService) {}

  @Post('estimate')
  @HttpCode(200)
  estimate(@Body() dto: EstimateTerrainDto) {
    return this.terrains.estimate(dto)
  }

  /** POST /api/terrains/site-check : vérification du terrain sur l'image satellite (IA) */
  @Post('site-check')
  @HttpCode(200)
  siteCheck(@Body() body: { polygon: unknown }) {
    return this.terrains.siteCheck(body?.polygon)
  }

  @Get()
  findAll() {
    return this.terrains.findAll()
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.terrains.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateTerrainDto) {
    return this.terrains.create(dto)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTerrainDto) {
    return this.terrains.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.terrains.remove(id)
  }
}
