import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

// Requires a real DATABASE_URL (and the rest of .env.example) — PrismaService
// connects on module init, so this is a genuine end-to-end check, not run in
// CI yet since no Postgres/Soroban RPC service is provisioned there.
describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok', service: 'stellar-tickets-backend' });
  });

  afterEach(async () => {
    await app.close();
  });
});
