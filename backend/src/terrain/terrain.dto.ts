import { PartialType } from '@nestjs/mapped-types'
import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Length, Max, Min } from 'class-validator'
import type { Irrigation } from './estimation.js'

export const IRRIGATIONS: Irrigation[] = ['goutte-a-goutte', 'aspersion', 'gravitaire', 'pluvial']
const MAX_YEAR = new Date().getFullYear() + 10

/**
 * Paramètres d'une estimation. La forme exacte du polygone (GeoJSON) est vérifiée
 * dans le service avec validatePolygon(), qui renvoie des messages d'erreur clairs.
 */
export class EstimateTerrainDto {
  @IsObject({ message: 'Le contour du terrain est obligatoire.' })
  polygon!: Record<string, unknown>

  @IsString()
  speciesId!: string

  /** null ou absent = terrain vide, plantation prévue cette année */
  @IsOptional()
  @IsInt({ message: "L'année de plantation doit être un nombre entier." })
  @Min(1900, { message: "L'année de plantation doit être après 1900." })
  @Max(MAX_YEAR, { message: `L'année de plantation ne peut pas dépasser ${MAX_YEAR}.` })
  plantingYear?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0.5, { message: "L'espacement entre rangs doit être d'au moins 0,5 m." })
  @Max(30, { message: "L'espacement entre rangs ne peut pas dépasser 30 m." })
  rowSpacingM?: number | null

  @IsOptional()
  @IsNumber()
  @Min(0.5, { message: "L'espacement sur le rang doit être d'au moins 0,5 m." })
  @Max(30, { message: "L'espacement sur le rang ne peut pas dépasser 30 m." })
  treeSpacingM?: number | null

  @IsIn(IRRIGATIONS, { message: `Irrigation : choisissez parmi ${IRRIGATIONS.join(', ')}.` })
  irrigation!: Irrigation

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'Le prix ne peut pas être négatif.' })
  @Max(1000)
  pricePerKg?: number | null
}

export class CreateTerrainDto extends EstimateTerrainDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 60, { message: 'Le nom doit faire entre 2 et 60 caractères.' })
  name!: string
}

/** Modification : tous les champs deviennent facultatifs */
export class UpdateTerrainDto extends PartialType(CreateTerrainDto) {}
