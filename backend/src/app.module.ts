import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AiModule } from './ai/ai.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { IrrigationModule } from './irrigation/irrigation.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MarketModule } from './market/market.module.js';
import { MeterModule } from './meter/meter.module.js';
import { PlantModule } from './plant/plant.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SpeciesModule } from './species/species.module.js';
import { TerrainModule } from './terrain/terrain.module.js';
import { TraceModule } from './trace/trace.module.js';

/**
 * Module racine : il assemble les modules fonctionnels.
 */
@Module({
  imports: [
    // Charge le fichier .env et rend ConfigService disponible partout
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    AiModule,
    SpeciesModule,
    TerrainModule,
    PlantModule,
    IrrigationModule,
    MeterModule,
    DashboardModule,
    AssistantModule,
    MarketModule,
    // Traçabilité (récolte → consommateur, registre chaîné + IA) : module additif
    TraceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
