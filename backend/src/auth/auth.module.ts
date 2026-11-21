import { Body, ConflictException, Controller, Get, Global, HttpCode, Injectable, Module, Post, Put, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  AuthenticationContext,
  AuthenticationModule,
  AuthenticationRegistry,
  CurrentUser,
  JwtBearerProvider,
  PasswordHasher,
  Public,
  TokenService,
  type JwtClaims,
} from '@nestjs/authentication'
import { Transform } from 'class-transformer'
import { IsEmail, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator'
import { Prisma } from '../generated/prisma/client.js'
import { PrismaService } from '../prisma/prisma.service.js'

/** Utilisateur connecté, sans le hash du mot de passe (il ne sort jamais du dépôt) */
export interface AuthUser {
  id: string
  email: string
  name: string
  farmName: string | null
  placeName: string | null
  lat: number | null
  lng: number | null
  createdAt: Date
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser
    refreshTokens: false
  }
}

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)
const PUBLIC_FIELDS = { id: true, email: true, name: true, farmName: true, placeName: true, lat: true, lng: true, createdAt: true } as const

// ─────────────────────────────── DTO ───────────────────────────────

export class SignInDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string

  @IsString()
  @MaxLength(200)
  password!: string
}

export class RegisterDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Votre nom doit faire entre 2 et 40 caractères.' })
  name!: string

  @Transform(lower)
  @IsEmail({}, { message: 'Adresse e-mail invalide.' })
  email!: string

  @IsString()
  @Length(8, 200, { message: 'Le mot de passe doit faire au moins 8 caractères.' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, { message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.' })
  password!: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 60)
  farmName?: string
}

export class ProfileDto {
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Votre nom doit faire entre 2 et 40 caractères.' })
  name!: string

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 60, { message: 'Le nom de l’exploitation ne peut pas dépasser 60 caractères.' })
  farmName?: string | null

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 80)
  placeName?: string | null

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number | null

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number | null
}

// ─────────────────────────────── Services ───────────────────────────────

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
  ) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS })
  }

  async register(dto: RegisterDto) {
    try {
      return await this.prisma.user.create({
        data: { email: dto.email, name: dto.name, farmName: dto.farmName || null, passwordHash: await this.hasher.hash(dto.password) },
        select: PUBLIC_FIELDS,
      })
    } catch (e) {
      // Contrainte d'unicité : pas de recherche préalable (elle laisserait passer deux inscriptions simultanées)
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.')
      throw e
    }
  }

  /** L'utilisateur, ou null si l'e-mail ou le mot de passe est faux (même durée dans les deux cas) */
  async verify(email: string, password: string) {
    const found = await this.prisma.user.findUnique({ where: { email } })
    const valid = await this.hasher.verify(password, found?.passwordHash)
    if (!valid || !found) return null
    if (this.hasher.needsRehash(found.passwordHash)) {
      await this.prisma.user.update({ where: { id: found.id }, data: { passwordHash: await this.hasher.hash(password) } })
    }
    return this.findById(found.id)
  }

  updateProfile(id: string, dto: ProfileDto) {
    return this.prisma.user.update({
      where: { id },
      data: { name: dto.name, farmName: dto.farmName || null, placeName: dto.placeName || null, lat: dto.lat ?? null, lng: dto.lng ?? null },
      select: PUBLIC_FIELDS,
    })
  }
}

/** Jeton « Authorization: Bearer … » → utilisateur rechargé à chaque requête (un compte supprimé est refusé aussitôt) */
@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly users: UsersService,
    registry: AuthenticationRegistry,
  ) {
    super()
    registry.registerProvider(this, { order: 1 })
  }

  validate({ sub }: JwtClaims) {
    return sub ? this.users.findById(sub) : null
  }
}

/** Identifiant de l'agriculteur connecté, pour filtrer ses données dans tous les services */
@Injectable()
export class CurrentUserId {
  constructor(private readonly context: AuthenticationContext) {}

  get(): string {
    return this.context.requireUser().id
  }
}

// ─────────────────────────────── Contrôleur ───────────────────────────────

/**
 * POST /api/auth/register   créer un compte (renvoie un jeton)
 * POST /api/auth/login      se connecter
 * GET  /api/auth/me         profil de l'agriculteur connecté
 * PUT  /api/auth/me         modifier son profil (nom, exploitation, lieu)
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.users.register(dto)
    return { user, ...(await this.tokens.issue(user.id, { method: 'password' })) }
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: SignInDto) {
    const user = await this.users.verify(dto.email, dto.password)
    if (!user) throw new UnauthorizedException('E-mail ou mot de passe incorrect.')
    return { user, ...(await this.tokens.issue(user.id, { method: 'password' })) }
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user
  }

  @Put('me')
  update(@CurrentUser('id') id: string, @Body() dto: ProfileDto) {
    return this.users.updateProfile(id, dto)
  }
}

@Global()
@Module({
  imports: [
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      // Jetons valables 7 jours, sans jeton de rafraîchissement (application de démonstration).
      // JWT_SECRET (32 octets minimum) est lu dans .env : sans lui, l'application refuse de démarrer.
      useFactory: (config: ConfigService) => ({ accessToken: { key: config.getOrThrow<string>('JWT_SECRET'), ttl: '7d' }, refreshToken: false }),
    }),
  ],
  controllers: [AuthController],
  providers: [UsersService, JwtAuth, CurrentUserId],
  exports: [CurrentUserId, UsersService],
})
export class AuthModule {}
