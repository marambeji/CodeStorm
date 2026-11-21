import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AiModule } from './ai/ai.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { HydroModule } from './hydro/hydro.module.js';
import { InvoiceModule } from './invoice/invoice.module.js';
import { MeterModule } from './meter/meter.module.js';
import { PlantModule } from './plant/plant.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SpeciesModule } from './species/species.module.js';
import { TerrainModule } from './terrain/terrain.module.js';

/**
 * Module racine : il assemble les modules fonctionnels.
 */
@Module({
  imports: [
    // Charge le fichier .env et rend ConfigService disponible partout
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AiModule,
    SpeciesModule,
    TerrainModule,
    PlantModule,
    InvoiceModule,
    HydroModule,
    MeterModule,
    DashboardModule,
    AssistantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
