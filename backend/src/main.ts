import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Toutes les routes commencent par /api (ex : /api/plant/diagnose)
  app.setGlobalPrefix('api');

  // CORS : autorise le frontend (une ou plusieurs URL séparées par des virgules dans FRONTEND_URL)
  app.enableCors({
    origin: config.get<string>('FRONTEND_URL', 'http://localhost:5173').split(','),
  });

  // Validation automatique des DTO (class-validator) :
  // - whitelist : supprime les champs inconnus
  // - forbidNonWhitelisted : renvoie une erreur 400 si un champ inconnu est envoyé
  // - transform : convertit les types (ex : "42" → 42)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // Fichiers envoyés (photos de feuilles, de compteurs…) servis sur /api/uploads/...
  const uploads = join(process.cwd(), 'uploads');
  mkdirSync(uploads, { recursive: true });
  app.useStaticAssets(uploads, { prefix: '/api/uploads', maxAge: '7d' });

  app.enableShutdownHooks();

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`🚀 EcoNexus API prête sur http://localhost:${port}/api`);
}
await bootstrap();
