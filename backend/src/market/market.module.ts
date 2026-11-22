import {
  BadRequestException,
  Body,
  ConflictException,
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
import { ArrayMaxSize, ArrayMinSize, IsBoolean, IsDate, IsIn, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxDate, Min, ValidateNested } from 'class-validator'
import { randomInt } from 'node:crypto'
import { CurrentUserId, type AuthUser } from '../auth/auth.module.js'
import { publicUrl, removeUpload, uploadOptions } from '../common/upload.js'
import type { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'
import {
  availableActions,
  CATEGORIES,
  checkQuantity,
  checkTransition,
  ON_THE_ROAD,
  ORDER_ACTIONS,
  orderTotals,
  RESTOCKING,
  round2,
  UNITS,
  type OrderAction,
  type OrderStatus,
  type Viewer,
} from './workflow.js'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
/** Formulaire multipart : "true"/"false" arrivent en texte */
const bool = ({ value }: { value: unknown }) => (value === 'true' || value === true ? true : value === 'false' || value === false ? false : value)
/** Champ vidé dans le formulaire → null (on efface la valeur) */
const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value)

// ─────────────────────────────── DTO ───────────────────────────────

export class ProductDto {
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Le nom du produit doit faire entre 2 et 60 caractères.' })
  name!: string

  @IsIn(CATEGORIES, { message: 'Catégorie inconnue.' })
  category!: string

  @IsIn(UNITS, { message: 'Unité inconnue.' })
  unit!: string

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Le prix doit être un nombre (2 décimales max).' })
  @Min(0.1, { message: 'Le prix doit être d’au moins 0,10.' })
  @Max(10_000)
  price!: number

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 }, { message: 'Le stock doit être un nombre (1 décimale max).' })
  @Min(0, { message: 'Le stock ne peut pas être négatif.' })
  @Max(1_000_000)
  stock!: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 500, { message: 'La description ne peut pas dépasser 500 caractères.' })
  description?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  origin?: string

  @IsOptional()
  @Transform(emptyToNull)
  @Type(() => Date)
  @IsDate({ message: 'Date de récolte invalide.' })
  @MaxDate(() => new Date(Date.now() + 86_400_000), { message: 'La date de récolte ne peut pas être dans le futur.' })
  harvestDate?: Date | null

  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  organic?: boolean

  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  active?: boolean

  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  removePhoto?: boolean
}

export class CartLineDto {
  @IsString()
  productId!: string

  @IsNumber({}, { message: 'Quantité invalide.' })
  @Max(10_000)
  quantity!: number
}

export class CheckoutDto {
  @ValidateNested({ each: true })
  @Type(() => CartLineDto)
  @ArrayMinSize(1, { message: 'Votre panier est vide.' })
  @ArrayMaxSize(50)
  items!: CartLineDto[]

  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Indiquez une adresse de livraison complète (5 caractères minimum).' })
  address!: string

  @Transform(trim)
  @Matches(/^[+\d][\d\s.-]{5,19}$/, { message: 'Numéro de téléphone invalide.' })
  phone!: string

  /** Point de livraison choisi sur la carte : indispensable pour le suivi et l'itinéraire du livreur */
  @IsNumber({}, { message: 'Placez le point de livraison sur la carte.' })
  @Min(-90)
  @Max(90)
  lat!: number

  @IsNumber({}, { message: 'Placez le point de livraison sur la carte.' })
  @Min(-180)
  @Max(180)
  lng!: number

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 300)
  note?: string
}

export class PositionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number
}

export class TransitionDto {
  @IsIn(ORDER_ACTIONS, { message: 'Action inconnue.' })
  action!: OrderAction

  /** Code à 4 chiffres donné par le client (obligatoire pour « livrer ») */
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Le code de remise fait 4 chiffres.' })
  code?: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 200)
  note?: string
}

// ─────────────────────────────── Service ───────────────────────────────

const FARMER_PUBLIC = { select: { id: true, name: true, farmName: true, placeName: true } } as const
const ORDER_INCLUDE = {
  items: true,
  events: { orderBy: { createdAt: 'asc' } },
  farmer: { select: { id: true, name: true, farmName: true, placeName: true, phone: true } },
  client: { select: { id: true, name: true } },
  courier: { select: { id: true, name: true, phone: true, liveLat: true, liveLng: true, liveAt: true } },
} satisfies Prisma.OrderInclude

type OrderWithAll = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly me: CurrentUserId,
  ) {}

  // ───── Catalogue (tout compte connecté) ─────

  catalog(q?: string, category?: string) {
    return this.prisma.product.findMany({
      where: {
        active: true,
        stock: { gt: 0 },
        ...(category && (CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
        ...(q?.trim() ? { OR: [{ name: { contains: q.trim() } }, { origin: { contains: q.trim() } }, { farmer: { farmName: { contains: q.trim() } } }] } : {}),
      },
      include: { farmer: FARMER_PUBLIC },
      orderBy: [{ harvestDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 200,
    })
  }

  async product(id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, active: true }, include: { farmer: FARMER_PUBLIC } })
    if (!p) throw new NotFoundException('Ce produit n’est plus en vente.')
    return p
  }

  // ───── Boutique de l'agriculteur ─────

  async myProducts() {
    const farmer = this.me.requireRole('agriculteur')
    const products = await this.prisma.product.findMany({ where: { farmerId: farmer.id }, orderBy: { createdAt: 'desc' } })
    // Quantités vendues (commandes livrées) pour chaque produit
    const sold = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: { farmerId: farmer.id, status: 'livree' }, productId: { in: products.map((p) => p.id) } },
      _sum: { quantity: true },
    })
    const soldBy = new Map(sold.map((s) => [s.productId, s._sum.quantity ?? 0]))
    return products.map((p) => ({ ...p, sold: soldBy.get(p.id) ?? 0 }))
  }

  createProduct(dto: ProductDto, file?: Express.Multer.File) {
    let farmer: AuthUser
    try {
      farmer = this.me.requireRole('agriculteur')
    } catch (e) {
      if (file) removeUpload(publicUrl('products', file.filename))
      throw e
    }
    return this.prisma.product.create({
      data: {
        farmerId: farmer.id,
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        price: dto.price,
        stock: dto.stock,
        description: dto.description || null,
        origin: dto.origin || null,
        harvestDate: dto.harvestDate ?? null,
        organic: dto.organic ?? false,
        active: dto.active ?? true,
        photoUrl: file ? publicUrl('products', file.filename) : null,
      },
    })
  }

  async updateProduct(id: string, dto: ProductDto, file?: Express.Multer.File) {
    const p = await this.ownProduct(id, file)
    const photoUrl = file ? publicUrl('products', file.filename) : dto.removePhoto ? null : p.photoUrl
    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category,
        unit: dto.unit,
        price: dto.price,
        stock: dto.stock,
        description: dto.description || null,
        origin: dto.origin || null,
        harvestDate: dto.harvestDate ?? null,
        organic: dto.organic ?? p.organic,
        active: dto.active ?? p.active,
        photoUrl,
      },
    })
    if (photoUrl !== p.photoUrl) removeUpload(p.photoUrl)
    return updated
  }

  /** Les commandes passées gardent le nom et le prix du produit : on peut le supprimer sans casser l'historique */
  async removeProduct(id: string) {
    const p = await this.ownProduct(id)
    await this.prisma.product.delete({ where: { id } })
    removeUpload(p.photoUrl)
    return { id, deleted: true }
  }

  private async ownProduct(id: string, file?: Express.Multer.File) {
    const farmer = this.me.requireRole('agriculteur')
    const p = await this.prisma.product.findFirst({ where: { id, farmerId: farmer.id } })
    if (!p) {
      if (file) removeUpload(publicUrl('products', file.filename))
      throw new NotFoundException('Ce produit n’existe pas.')
    }
    return p
  }

  // ───── Commandes ─────

  /**
   * Passer commande : le panier est découpé par ferme (une commande par agriculteur).
   * Le stock est réservé dans la même transaction : deux clients ne peuvent pas acheter la même dernière caisse.
   */
  async checkout(dto: CheckoutDto) {
    const client = this.me.requireRole('client')
    // Même produit ajouté deux fois → une seule ligne
    const wanted = new Map<string, number>()
    for (const l of dto.items) wanted.set(l.productId, round2((wanted.get(l.productId) ?? 0) + l.quantity))

    const orders = await this.prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({ where: { id: { in: [...wanted.keys()] }, active: true } })
      const byFarmer = new Map<string, { product: (typeof products)[number]; quantity: number }[]>()
      for (const [productId, quantity] of wanted) {
        const product = products.find((p) => p.id === productId)
        if (!product) throw new BadRequestException('Un produit de votre panier n’est plus en vente. Retirez-le puis réessayez.')
        const qErr = checkQuantity(product.unit, quantity)
        if (qErr) throw new BadRequestException(`${product.name} : ${qErr}`)
        // Décrément conditionnel : échoue si le stock a baissé entre-temps
        const { count } = await tx.product.updateMany({ where: { id: productId, active: true, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })
        if (count === 0) throw new ConflictException(`Stock insuffisant pour « ${product.name} » : il reste ${product.stock} ${product.unit}.`)
        byFarmer.set(product.farmerId, [...(byFarmer.get(product.farmerId) ?? []), { product, quantity }])
      }

      // Position de chaque ferme (profil de l'agriculteur), figée dans la commande
      const farms = await tx.user.findMany({ where: { id: { in: [...byFarmer.keys()] } }, select: { id: true, lat: true, lng: true } })
      const created: OrderWithAll[] = []
      for (const [farmerId, lines] of byFarmer) {
        const farm = farms.find((f) => f.id === farmerId)
        const items = lines.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          unit: product.unit,
          unitPrice: product.price,
          quantity,
          lineTotal: round2(product.price * quantity),
        }))
        created.push(
          await tx.order.create({
            data: {
              reference: reference(),
              clientId: client.id,
              farmerId,
              address: dto.address,
              deliveryLat: dto.lat,
              deliveryLng: dto.lng,
              pickupLat: farm?.lat ?? null,
              pickupLng: farm?.lng ?? null,
              phone: dto.phone,
              note: dto.note || null,
              ...orderTotals(items),
              deliveryCode: String(randomInt(0, 10_000)).padStart(4, '0'),
              items: { create: items },
              events: { create: { status: 'en_attente', actorRole: 'client', actorName: client.name, note: 'Commande passée' } },
            },
            include: ORDER_INCLUDE,
          }),
        )
      }
      return created
    })
    return orders.map((o) => this.present(o, client))
  }

  /** Les commandes qui me concernent, selon mon rôle */
  async myOrders() {
    const user = this.me.user()
    const where: Prisma.OrderWhereInput = user.role === 'client' ? { clientId: user.id } : user.role === 'agriculteur' ? { farmerId: user.id } : { courierId: user.id }
    const orders = await this.prisma.order.findMany({ where, include: ORDER_INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 })
    return orders.map((o) => this.present(o, user))
  }

  /** Livreur : commandes prêtes à la ferme, que personne n'a encore prises */
  async availableDeliveries() {
    const courier = this.me.requireRole('livreur')
    const orders = await this.prisma.order.findMany({ where: { status: 'prete', courierId: null }, include: ORDER_INCLUDE, orderBy: { updatedAt: 'asc' } })
    return orders.map((o) => this.present(o, courier))
  }

  async order(id: string) {
    const user = this.me.user()
    const o = await this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE })
    if (!o || !this.canSee(o, user)) throw new NotFoundException('Cette commande n’existe pas.')
    return this.present(o, user)
  }

  /** Faire avancer une commande d'une étape (règles dans workflow.ts) */
  async transition(id: string, dto: TransitionDto) {
    const user = this.me.user()
    const o = await this.prisma.order.findUnique({ where: { id }, include: { items: true } })
    if (!o || !this.canSee(o, user)) throw new NotFoundException('Cette commande n’existe pas.')

    const check = checkTransition(dto.action, o.status as OrderStatus, viewerOf(o, user))
    if (!check.ok) throw check.reason === 'status' ? new ConflictException(check.message) : new BadRequestException(check.message)
    if (dto.action === 'livrer' && dto.code !== o.deliveryCode) throw new BadRequestException('Code de remise incorrect. Demandez au client le code affiché dans sa commande.')

    await this.prisma.$transaction(async (tx) => {
      // Mise à jour conditionnelle : si quelqu'un a déjà changé le statut (ou pris la livraison), on refuse
      const { count } = await tx.order.updateMany({
        where: { id, status: o.status, ...(dto.action === 'prendre' ? { courierId: null } : {}) },
        data: { status: check.to, ...(dto.action === 'prendre' ? { courierId: user.id } : {}) },
      })
      if (count === 0) throw new ConflictException('La commande vient d’être modifiée par quelqu’un d’autre. Actualisez la page.')
      if (RESTOCKING.includes(check.to)) {
        for (const it of o.items) {
          if (it.productId) await tx.product.updateMany({ where: { id: it.productId }, data: { stock: { increment: it.quantity } } })
        }
      }
      await tx.orderEvent.create({ data: { orderId: id, status: check.to, actorRole: user.role, actorName: user.name, note: dto.note || null } })
    })
    return this.order(id)
  }

  /** Chiffres clés de la boutique (agriculteur) */
  async farmerSummary() {
    const farmer = this.me.requireRole('agriculteur')
    const [byStatus, products, lowStock] = await Promise.all([
      this.prisma.order.groupBy({ by: ['status'], where: { farmerId: farmer.id }, _count: true, _sum: { subtotal: true } }),
      this.prisma.product.count({ where: { farmerId: farmer.id, active: true } }),
      this.prisma.product.count({ where: { farmerId: farmer.id, active: true, stock: { lte: 5 } } }),
    ])
    const get = (s: OrderStatus) => byStatus.find((b) => b.status === s)
    return {
      revenue: round2(get('livree')?._sum.subtotal ?? 0),
      delivered: get('livree')?._count ?? 0,
      toHandle: (get('en_attente')?._count ?? 0) + (get('acceptee')?._count ?? 0),
      inTransit: (get('prete')?._count ?? 0) + (get('prise_en_charge')?._count ?? 0) + (get('en_livraison')?._count ?? 0),
      activeProducts: products,
      lowStock,
    }
  }

  /**
   * Le livreur partage sa position GPS pendant sa tournée.
   * Sans commande en cours, la position est effacée et n'est plus enregistrée (vie privée).
   */
  async updatePosition(dto: PositionDto) {
    const courier = this.me.requireRole('livreur')
    const active = await this.prisma.order.count({ where: { courierId: courier.id, status: { in: ON_THE_ROAD } } })
    if (!active) {
      await this.prisma.user.update({ where: { id: courier.id }, data: { liveLat: null, liveLng: null, liveAt: null } })
      return { tracking: false }
    }
    const at = new Date()
    await this.prisma.user.update({ where: { id: courier.id }, data: { liveLat: dto.lat, liveLng: dto.lng, liveAt: at } })
    return { tracking: true, at }
  }

  private canSee(o: { clientId: string; farmerId: string; courierId: string | null; status: string }, user: AuthUser) {
    return o.clientId === user.id || o.farmerId === user.id || o.courierId === user.id || (user.role === 'livreur' && o.status === 'prete' && o.courierId === null)
  }

  /** Ce que chacun voit : le code de remise n'est montré qu'au client */
  private present(o: OrderWithAll, user: AuthUser) {
    const viewer = viewerOf(o, user)
    const { deliveryCode, courier, ...rest } = o
    // Position du livreur : seulement pendant le trajet de CETTE commande
    const live = courier && ON_THE_ROAD.includes(o.status as OrderStatus) && courier.liveLat !== null && courier.liveLng !== null && courier.liveAt ? { lat: courier.liveLat, lng: courier.liveLng, at: courier.liveAt } : null
    return {
      ...rest,
      courier: courier ? { id: courier.id, name: courier.name, phone: courier.phone, live } : null,
      deliveryCode: viewer.isClient ? deliveryCode : null,
      actions: availableActions(o.status as OrderStatus, viewer, o.courierId !== null),
    }
  }
}

function viewerOf(o: { clientId: string; farmerId: string; courierId: string | null }, user: AuthUser): Viewer {
  return { role: user.role, isClient: o.clientId === user.id, isFarmer: o.farmerId === user.id, isCourier: o.courierId === user.id }
}

/** Référence lisible, sans caractères ambigus (0/O, 1/I) */
function reference() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'EN-' + Array.from({ length: 6 }, () => A[randomInt(0, A.length)]).join('')
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * Marché EcoNexus
 *   GET    /api/market/products?q=&category=   catalogue (produits en vente, en stock)
 *   GET    /api/market/products/:id
 *   GET    /api/market/my-products              agriculteur : ses produits (+ quantités vendues)
 *   POST   /api/market/my-products              agriculteur : mettre en vente (photo facultative)
 *   PATCH  /api/market/my-products/:id          agriculteur : modifier
 *   DELETE /api/market/my-products/:id          agriculteur : supprimer
 *   GET    /api/market/summary                  agriculteur : chiffres clés
 *   POST   /api/market/orders                   client : passer commande (un panier → une commande par ferme)
 *   GET    /api/market/orders                   mes commandes (client), reçues (agriculteur), mes livraisons (livreur)
 *   GET    /api/market/orders/:id
 *   POST   /api/market/orders/:id/transition    faire avancer : accepter, refuser, preparer, annuler, prendre, livrer
 *   GET    /api/market/deliveries/available     livreur : commandes prêtes à récupérer
 *   POST   /api/market/courier/position         livreur : position GPS pendant la tournée (suivi en direct)
 */
@Controller('market')
export class MarketController {
  constructor(private readonly market: MarketService) {}

  @Get('products')
  catalog(@Query('q') q?: string, @Query('category') category?: string) {
    return this.market.catalog(q, category)
  }

  @Get('products/:id')
  product(@Param('id') id: string) {
    return this.market.product(id)
  }

  @Get('my-products')
  myProducts() {
    return this.market.myProducts()
  }

  @Post('my-products')
  @UseInterceptors(FileInterceptor('photo', uploadOptions('products', 'image', 6)))
  createProduct(@Body() dto: ProductDto, @UploadedFile() file?: Express.Multer.File) {
    return this.market.createProduct(dto, file)
  }

  @Patch('my-products/:id')
  @UseInterceptors(FileInterceptor('photo', uploadOptions('products', 'image', 6)))
  updateProduct(@Param('id') id: string, @Body() dto: ProductDto, @UploadedFile() file?: Express.Multer.File) {
    return this.market.updateProduct(id, dto, file)
  }

  @Delete('my-products/:id')
  removeProduct(@Param('id') id: string) {
    return this.market.removeProduct(id)
  }

  @Get('summary')
  summary() {
    return this.market.farmerSummary()
  }

  @Post('orders')
  checkout(@Body() dto: CheckoutDto) {
    return this.market.checkout(dto)
  }

  @Get('orders')
  orders() {
    return this.market.myOrders()
  }

  @Get('orders/:id')
  order(@Param('id') id: string) {
    return this.market.order(id)
  }

  @Post('orders/:id/transition')
  @HttpCode(200)
  transition(@Param('id') id: string, @Body() dto: TransitionDto) {
    return this.market.transition(id, dto)
  }

  @Get('deliveries/available')
  available() {
    return this.market.availableDeliveries()
  }

  @Post('courier/position')
  @HttpCode(200)
  position(@Body() dto: PositionDto) {
    return this.market.updatePosition(dto)
  }
}

@Module({ controllers: [MarketController], providers: [MarketService] })
export class MarketModule {}
