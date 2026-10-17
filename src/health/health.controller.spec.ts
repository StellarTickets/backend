import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let app: INestApplication;
  let server: Server;
  let prismaService: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prismaService = {
      $queryRaw: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('returns 200 with service status', async () => {
      const res = await request(server).get('/health').expect(200);

      expect(res.body).toEqual({
        status: 'ok',
        service: 'stellar-tickets-backend',
      });
    });
  });

  describe('GET /health/live', () => {
    it('returns 200 with liveness status', async () => {
      const res = await request(server).get('/health/live').expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 when database connectivity check succeeds', async () => {
      prismaService.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      const res = await request(server).get('/health/ready').expect(200);

      expect(res.body).toEqual({
        status: 'ok',
        database: 'connected',
      });
      expect(prismaService.$queryRaw).toHaveBeenCalled();
    });

    it('returns 503 when database connectivity check fails', async () => {
      prismaService.$queryRaw.mockRejectedValueOnce(
        new Error('Connection refused'),
      );

      const res = await request(server).get('/health/ready').expect(503);

      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 503,
          status: 'error',
          database: 'disconnected',
        }),
      );
    });
  });
});
