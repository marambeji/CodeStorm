import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';

describe('Parcours API EcoNexus mobile', () => {
  const password = 'Mobile2026!';
  let directory: string;
  let app: INestApplication<App>;

  beforeAll(async () => {
    directory = mkdtempSync(join(tmpdir(), 'econexus-mobile-'));
    const path = join(directory, 'test.db');
    const database = new DatabaseSync(path);
    try {
      const migrations = new URL('../prisma/migrations/', import.meta.url);
      const folders = readdirSync(migrations, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const folder of folders) {
        database.exec(readFileSync(new URL(`${folder}/migration.sql`, migrations), 'utf8'));
      }
    } finally {
      database.close();
    }

    vi.stubEnv('DATABASE_URL', `file:${path}`);
    vi.stubEnv('JWT_SECRET', 'econexus-mobile-integration-test-key');
    vi.stubEnv('LLM_API_KEY', '');
    const fixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = fixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();
  });

  afterAll(async () => {
    try {
      await app?.close();
    } finally {
      vi.unstubAllEnvs();
      if (directory) rmSync(directory, { recursive: true, force: true });
    }
  });

  async function signIn(role: string) {
    const email = `${role}-${randomUUID()}@example.test`;
    await request(app.getHttpServer()).post('/api/auth/register')
      .send({ name: 'Mobile Test', email, password, role }).expect(201);
    const login = await request(app.getHttpServer()).post('/api/auth/login')
      .send({ email, password }).expect(200);
    return `Bearer ${login.body.accessToken}`;
  }

  it.each([
    ['agriculteur', [
      'dashboard', 'plant/history', 'terrains', 'species', 'irrigation/plans',
      'meter/meters', 'market/my-products', 'trace/lots',
    ]],
    ['client', ['market/products', 'market/orders', 'trace/lots']],
    ['livreur', ['market/deliveries/available', 'market/orders', 'trace/lots']],
  ] as const)('ouvre les données des écrans du rôle %s', async (role, endpoints) => {
    const authorization = await signIn(role);
    const server = app.getHttpServer();
    const profile = await request(server).get('/api/auth/me').set('Authorization', authorization).expect(200);
    expect(profile.body.role).toBe(role);

    for (const endpoint of endpoints) {
      await request(server).get(`/api/${endpoint}`).set('Authorization', authorization).expect(200);
    }

    if (role === 'agriculteur') {
      const response = await request(server).post('/api/assistant/chat')
        .set('Authorization', authorization)
        .send({ messages: [{ role: 'user', content: 'Comment planifier mon irrigation ?' }], lang: 'fr', page: '/app/irriplan' })
        .expect(200);
      expect(response.body).toMatchObject({ source: 'mock', reply: expect.any(String) });
    } else {
      await request(server).get('/api/market/my-products').set('Authorization', authorization).expect(403);
    }
  });

  it('laisse le catalogue PlantDoc public et protège les données de compte', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/plant/catalog').expect(200);
    await request(server).get('/api/auth/me').expect(401);
  });

  it('réserve le stock et livre une commande avec le code du client', async () => {
    const farmer = await signIn('agriculteur');
    const client = await signIn('client');
    const courier = await signIn('livreur');
    const server = app.getHttpServer();

    const product = await request(server).post('/api/market/my-products').set('Authorization', farmer)
      .send({ name: 'Tomates', category: 'legumes', unit: 'kg', price: 3, stock: 10 }).expect(201);
    const checkout = await request(server).post('/api/market/orders').set('Authorization', client)
      .send({
        items: [{ productId: product.body.id, quantity: 2 }],
        address: '10 rue du Marché', phone: '22112233', lat: 36.8, lng: 10.2,
      }).expect(201);
    const [order] = checkout.body;
    expect(order).toMatchObject({ status: 'en_attente', deliveryCode: expect.stringMatching(/^\d{4}$/) });

    const inventory = await request(server).get('/api/market/my-products').set('Authorization', farmer).expect(200);
    expect(inventory.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: product.body.id, stock: 8 })]));

    const transition = (authorization: string, action: string, code?: string) =>
      request(server).post(`/api/market/orders/${order.id}/transition`)
        .set('Authorization', authorization).send({ action, code });

    await transition(farmer, 'accepter').expect(200);
    await transition(farmer, 'preparer').expect(200);
    const available = await request(server).get('/api/market/deliveries/available')
      .set('Authorization', courier).expect(200);
    expect(available.body).toEqual(expect.arrayContaining([expect.objectContaining({ id: order.id, deliveryCode: null })]));
    await transition(courier, 'prendre').expect(200);
    await transition(courier, 'recuperer').expect(200);
    const delivered = await transition(courier, 'livrer', order.deliveryCode).expect(200);
    expect(delivered.body.status).toBe('livree');
  });

  it('expose la fiche QR d’un lot sans demander de connexion', async () => {
    const farmer = await signIn('agriculteur');
    const server = app.getHttpServer();
    const lot = await request(server).post('/api/trace/lots').set('Authorization', farmer)
      .send({
        product: 'Tomates', category: 'legumes', quantity: 10, unit: 'kg',
        harvestDate: new Date().toISOString(),
      }).expect(201);
    const response = await request(server).get(`/api/trace/public/${lot.body.code}`).expect(200);
    expect(response.body).toMatchObject({ code: lot.body.code, product: 'Tomates' });
    expect(response.body).not.toHaveProperty('farmerId');
  });
});
