import { BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, Post } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Public } from '@nestjs/authentication'
import { Transform, Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsDate, IsIn, IsNumber, IsOptional, IsString, Length, Max, MaxDate, Min, ValidateNested } from 'class-validator'
import { randomInt } from 'node:crypto'
import { CurrentUserId, type AuthUser } from '../auth/auth.module.js'
import { Prisma } from '../generated/prisma/client.js'
import { CATEGORIES, UNITS } from '../market/workflow.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { predictFreshness } from './freshness.js'
import { forecastSeries, recommendations, weeklyBuckets, type DemandForecast, type LotView } from './insights.js'
import { ACTOR_ROLES, checkNextStage, checkSeal, GENESIS_PREV, hashBlock, NEXT_STAGES, sealOrigin, verifyChain, type BlockData } from './ledger.js'
import { optimizeRoute } from './route.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value)

// ─────────────────────────────── DTO ───────────────────────────────

export class HarvestLotDto {
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Le nom du produit doit faire entre 2 et 60 caractères.' })
  product!: string

  @IsIn(CATEGORIES, { message: 'Catégorie inconnue.' })
  category!: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 60)
  variety?: string

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Quantité invalide.' })
  @Min(0.1, { message: 'La quantité doit être positive.' })
  @Max(1_000_000)
  quantity!: number

  @IsIn(UNITS, { message: 'Unité inconnue.' })
  unit!: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  parcel?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  placeName?: string

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number

  @Type(() => Date)
  @IsDate({ message: 'Date de récolte invalide.' })
  @MaxDate(() => new Date(Date.now() + 86_400_000), { message: 'La date de récolte ne peut pas être dans le futur.' })
  harvestDate!: Date

  @IsOptional()
  @IsBoolean()
  organic?: boolean

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumber({}, { message: 'Température invalide.' })
  @Min(-30)
  @Max(60)
  temperature?: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 300)
  notes?: string
}

export class TraceStepDto {
  @IsIn(NEXT_STAGES, { message: 'Étape inconnue.' })
  stage!: string

  @IsIn(ACTOR_ROLES, { message: 'Rôle inconnu : collecteur, transporteur, distributeur…' })
  actorRole!: string

  /** Entreprise / structure de l'acteur (facultatif, affichée au consommateur) */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 60)
  organization?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  placeName?: string

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumber({}, { message: 'Température invalide.' })
  @Min(-30)
  @Max(60)
  temperature?: number

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsNumber({}, { message: 'Quantité invalide.' })
  @Min(0)
  @Max(1_000_000)
  quantity?: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 300)
  note?: string
}

export class RoutePointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  label?: string
}

export class RouteDto {
  @ValidateNested()
  @Type(() => RoutePointDto)
  start!: RoutePointDto

  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  @ArrayMinSize(1, { message: 'Ajoutez au moins un arrêt.' })
  @ArrayMaxSize(25, { message: '25 arrêts maximum.' })
  stops!: RoutePointDto[]

  @IsOptional()
  @IsBoolean()
  returnToStart?: boolean
}

// ─────────────────────────────── Service ───────────────────────────────

const LOT_INCLUDE = {
  blocks: { orderBy: { index: 'asc' } },
  farmer: { select: { id: true, name: true, farmName: true, placeName: true } },
} satisfies Prisma.HarvestLotInclude

type LotWithAll = Prisma.HarvestLotGetPayload<{ include: typeof LOT_INCLUDE }>

const STAGE_LABEL: Record<string, string> = {
  recolte: 'Récolte',
  collecte: 'Collecte',
  transport: 'Transport',
  stockage: 'Stockage',
  distribution: 'Distribution',
  vente: 'Vente au consommateur',
}

@Injectable()
export class TraceService {
  private readonly secret: string

  constructor(
    private readonly prisma: PrismaService,
    private readonly me: CurrentUserId,
    config: ConfigService,
  ) {
    this.secret = config.getOrThrow<string>('JWT_SECRET')
  }

  // ───── Module agriculteur : enregistrer une récolte ─────

  async createLot(dto: HarvestLotDto) {
    const farmer = this.me.requireRole('agriculteur')
    const createdAt = new Date()
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = lotCode()
      const genesis: BlockData = {
        index: 0,
        stage: 'recolte',
        actorId: farmer.id,
        actorRole: 'agriculteur',
        actorName: farmer.farmName || farmer.name,
        placeName: dto.placeName || dto.parcel || farmer.placeName || null,
        lat: dto.lat ?? farmer.lat ?? null,
        lng: dto.lng ?? farmer.lng ?? null,
        temperature: dto.temperature ?? null,
        quantity: dto.quantity,
        note: dto.notes || null,
        prevHash: GENESIS_PREV,
        createdAt,
      }
      const hash = hashBlock(code, genesis)
      try {
        const lot = await this.prisma.harvestLot.create({
          data: {
            code,
            farmerId: farmer.id,
            product: dto.product,
            category: dto.category,
            variety: dto.variety || null,
            quantity: dto.quantity,
            unit: dto.unit,
            parcel: dto.parcel || null,
            placeName: genesis.placeName,
            lat: genesis.lat,
            lng: genesis.lng,
            harvestDate: dto.harvestDate,
            organic: dto.organic ?? false,
            notes: dto.notes || null,
            certificate: sealOrigin(this.secret, code, hash, farmer.id),
            blocks: { create: { ...genesis, hash } },
          },
          include: LOT_INCLUDE,
        })
        return this.present(lot)
      } catch (e) {
        // Code déjà pris (très improbable) : on en tire un autre
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue
        throw e
      }
    }
    throw new ConflictException('Impossible de générer un identifiant de lot. Réessayez.')
  }

  /** Agriculteur : ses lots. Autres acteurs : les lots qu'ils ont manipulés. */
  async myLots() {
    const lots = await this.prisma.harvestLot.findMany({ where: this.scope(this.me.user()), include: LOT_INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 })
    return lots.map((l) => this.present(l))
  }

  /** Lots encore dans la chaîne (pas vendus), localisés : à collecter / transporter. Tous les acteurs connectés. */
  async openLots() {
    this.me.user()
    const lots = await this.prisma.harvestLot.findMany({ where: { stage: { not: 'vente' } }, include: LOT_INCLUDE, orderBy: { harvestDate: 'asc' }, take: 100 })
    return lots.map((l) => this.present(l))
  }

  async lot(code: string) {
    this.me.user()
    return this.present(await this.find(code))
  }

  // ───── Supply chain : chaque acteur ajoute son bloc ─────

  async addStep(code: string, dto: TraceStepDto) {
    const user = this.me.user()
    const lot = await this.find(code)
    const err = checkNextStage(
      lot.blocks.map((b) => b.stage),
      dto.stage,
    )
    if (err) throw new BadRequestException(err)
    const last = lot.blocks[lot.blocks.length - 1]
    const name = user.farmName || user.name
    const block: BlockData = {
      index: last.index + 1,
      stage: dto.stage,
      actorId: user.id,
      actorRole: dto.actorRole,
      actorName: dto.organization ? `${name} · ${dto.organization}` : name,
      placeName: dto.placeName || null,
      lat: dto.lat ?? null,
      lng: dto.lng ?? null,
      temperature: dto.temperature ?? null,
      quantity: dto.quantity ?? null,
      note: dto.note || null,
      prevHash: last.hash,
      createdAt: new Date(),
    }
    try {
      await this.prisma.$transaction([
        this.prisma.traceBlock.create({ data: { ...block, lotId: lot.id, hash: hashBlock(lot.code, block) } }),
        this.prisma.harvestLot.update({ where: { id: lot.id }, data: { stage: dto.stage } }),
      ])
    } catch (e) {
      // Deux acteurs enregistrent en même temps : l'index (lotId, index) est unique
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Une autre étape vient d’être enregistrée sur ce lot. Actualisez puis réessayez.')
      throw e
    }
    return this.lot(lot.code)
  }

  // ───── Module consommateur : page publique du QR code ─────

  async publicLot(code: string) {
    const lot = await this.find(code)
    const p = this.present(lot)
    // Pas d'identifiants internes côté public
    return {
      ...p,
      id: undefined,
      farmerId: undefined,
      blocks: p.blocks.map(({ actorId: _a, lotId: _l, id: _i, ...b }) => b),
    }
  }

  // ───── Module IA : demande + recommandations ─────

  async insights() {
    const user = this.me.user()
    const WEEKS = 8
    const since = new Date(Date.now() - WEEKS * 7 * 86_400_000)
    const [items, lots] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: { order: { createdAt: { gte: since }, status: { notIn: ['refusee', 'annulee'] } }, product: { isNot: null } },
        select: { quantity: true, order: { select: { createdAt: true } }, product: { select: { category: true } } },
      }),
      this.prisma.harvestLot.findMany({ where: this.scope(user), include: LOT_INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 }),
    ])

    const byCat = new Map<string, { at: Date; quantity: number }[]>()
    for (const it of items) {
      const c = it.product!.category
      byCat.set(c, [...(byCat.get(c) ?? []), { at: it.order.createdAt, quantity: it.quantity }])
    }
    // Catégories vendues + catégories des lots de l'utilisateur
    const cats = new Set([...byCat.keys(), ...lots.map((l) => l.category)])
    const demand: DemandForecast[] = [...cats].map((category) => {
      const history = weeklyBuckets(byCat.get(category) ?? [], WEEKS)
      return { category, history, ...forecastSeries(history) }
    })
    demand.sort((a, b) => b.forecast - a.forecast)

    const views: LotView[] = lots.map((l) => ({
      code: l.code,
      product: l.product,
      category: l.category,
      quantity: l.quantity,
      unit: l.unit,
      stage: l.stage,
      harvestDate: l.harvestDate,
      freshness: this.freshness(l),
      lastQuantity: lastQuantity(l),
      blocks: l.blocks,
    }))
    const open = views.filter((v) => v.stage !== 'vente')
    return {
      demand,
      recommendations: recommendations(views, demand),
      stats: {
        lots: views.length,
        inTransit: open.length,
        atRisk: open.filter((v) => ['limite', 'a-consommer-vite', 'perime'].includes(v.freshness.level)).length,
        avgFreshness: open.length ? Math.round(open.reduce((s, v) => s + v.freshness.score, 0) / open.length) : null,
        lossQuantity: Math.round(views.reduce((s, v) => s + Math.max(0, v.quantity - v.lastQuantity), 0) * 10) / 10,
      },
    }
  }

  // ───── Supply chain : optimisation d'itinéraire ─────

  optimize(dto: RouteDto) {
    this.me.user()
    const result = optimizeRoute(dto.start, dto.stops, dto.returnToStart ?? false)
    return { ...result, stops: result.order.map((i) => ({ ...dto.stops[i], index: i })) }
  }

  // ───── Interne ─────

  private scope(user: AuthUser): Prisma.HarvestLotWhereInput {
    return user.role === 'agriculteur' ? { OR: [{ farmerId: user.id }, { blocks: { some: { actorId: user.id } } }] } : { blocks: { some: { actorId: user.id } } }
  }

  private async find(code: string) {
    const lot = await this.prisma.harvestLot.findUnique({ where: { code: normalizeCode(code) }, include: LOT_INCLUDE })
    if (!lot) throw new NotFoundException('Aucun lot ne correspond à ce code. Vérifiez le QR code ou l’identifiant.')
    return lot
  }

  private freshness(l: LotWithAll) {
    return predictFreshness(
      l.category,
      l.harvestDate,
      l.blocks.map((b) => ({ at: b.createdAt, temperature: b.temperature })),
    )
  }

  private present(l: LotWithAll) {
    const chain = verifyChain(l.code, l.blocks)
    const genesis = l.blocks[0]
    const certified = Boolean(genesis) && genesis.actorId === l.farmerId && checkSeal(this.secret, l.certificate, l.code, genesis.hash, l.farmerId)
    const legs = l.blocks.slice(1).map((b, i) => ({
      from: l.blocks[i].actorName,
      to: b.actorName,
      fromRole: l.blocks[i].actorRole,
      toRole: b.actorRole,
      stage: b.stage,
      at: b.createdAt,
    }))
    return {
      ...l,
      stageLabel: STAGE_LABEL[l.stage] ?? l.stage,
      currentQuantity: lastQuantity(l),
      freshness: this.freshness(l),
      verification: { ...chain, certified, lastHash: l.blocks[l.blocks.length - 1]?.hash ?? null },
      /** Traçabilité des responsabilités : qui a remis le lot à qui, et quand */
      handovers: legs,
    }
  }
}

function lastQuantity(l: { quantity: number; blocks: { quantity: number | null }[] }) {
  const qs = l.blocks.map((b) => b.quantity).filter((q): q is number => q !== null)
  return qs.length ? qs[qs.length - 1] : l.quantity
}

/** Identifiant unique de lot, sans caractères ambigus (0/O, 1/I) */
function lotCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'LOT-' + Array.from({ length: 6 }, () => A[randomInt(0, A.length)]).join('')
}

/** Accepte « lot-ab12cd », « AB12CD » ou l'URL complète du QR code */
export function normalizeCode(raw: string) {
  const last = decodeURIComponent(raw).trim().split('/').filter(Boolean).pop() ?? ''
  const up = last.toUpperCase()
  return up.startsWith('LOT-') ? up : `LOT-${up}`
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * Traçabilité EcoNexus (module additif, n'affecte pas le marché)
 *   POST /api/trace/lots                  agriculteur : enregistrer une récolte (crée le lot + bloc d'origine)
 *   GET  /api/trace/lots                  mes lots (agriculteur) / lots que j'ai manipulés (autres acteurs)
 *   GET  /api/trace/open                  lots en circulation (à collecter, transporter, distribuer)
 *   GET  /api/trace/lots/:code            détail d'un lot (chaîne, fraîcheur, vérification)
 *   POST /api/trace/lots/:code/steps      collecteur / transporteur / distributeur : ajouter une étape
 *   GET  /api/trace/insights              IA : prédiction de la demande, recommandations anti-pertes
 *   POST /api/trace/route                 optimisation d'un itinéraire (collecte / livraison)
 *   GET  /api/trace/public/:code          PUBLIC — consommateur : origine, transport, fraîcheur (QR code)
 */
@Controller('trace')
export class TraceController {
  constructor(private readonly trace: TraceService) {}

  @Post('lots')
  create(@Body() dto: HarvestLotDto) {
    return this.trace.createLot(dto)
  }

  @Get('lots')
  lots() {
    return this.trace.myLots()
  }

  @Get('open')
  open() {
    return this.trace.openLots()
  }

  @Get('lots/:code')
  lot(@Param('code') code: string) {
    return this.trace.lot(code)
  }

  @Post('lots/:code/steps')
  step(@Param('code') code: string, @Body() dto: TraceStepDto) {
    return this.trace.addStep(code, dto)
  }

  @Get('insights')
  insights() {
    return this.trace.insights()
  }

  @Post('route')
  @HttpCode(200)
  route(@Body() dto: RouteDto) {
    return this.trace.optimize(dto)
  }

  @Public()
  @Get('public/:code')
  publicLot(@Param('code') code: string) {
    return this.trace.publicLot(code)
  }
}

@Module({ controllers: [TraceController], providers: [TraceService] })
export class TraceModule {}
