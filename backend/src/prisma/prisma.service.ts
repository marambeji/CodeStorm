import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Service d'accès à la base de données.
 * Il hérite de PrismaClient : on peut donc écrire `this.prisma.meterReading.findMany()`
 * dans n'importe quel service qui l'injecte.
 *
 * Prisma 7 passe par un "driver adapter" : ici better-sqlite3 pour lire/écrire le fichier SQLite.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const url = config.get<string>('DATABASE_URL', 'file:./dev.db');
    super({ adapter: new PrismaBetterSqlite3({ url }) });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
