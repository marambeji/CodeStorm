import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  const queryRaw = vi.fn();
  let appController: AppController;

  async function setup(apiKey?: string) {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: ConfigService, useValue: { get: () => apiKey } },
      ],
    }).compile();
    appController = app.get(AppController);
  }

  // Accolades obligatoires : une fonction renvoyée par beforeEach est exécutée comme "cleanup" par Vitest
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it('reports mock AI mode when no API key is set', async () => {
    await setup();
    queryRaw.mockResolvedValue([{ 1: 1 }]);
    expect(await appController.health()).toEqual({ status: 'ok', database: 'up', aiMode: 'mock' });
  });

  it('reports llm mode and database down', async () => {
    await setup('sk-test');
    queryRaw.mockRejectedValue(new Error('db unreachable'));
    expect(await appController.health()).toEqual({ status: 'ok', database: 'down', aiMode: 'llm' });
  });
});
