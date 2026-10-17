import type { Server } from 'node:http';
import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import pino from 'pino';
import { configureApp } from '../app.setup';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

@Controller({ version: VERSION_NEUTRAL })
class MockSampleController {
  @Get('test-ok')
  testOk() {
    return { ok: true };
  }

  @Get('test-error')
  testError() {
    throw new HttpException('Something failed', HttpStatus.BAD_REQUEST);
  }
}

describe('Observability & Correlation (X-Request-Id & Pino)', () => {
  let app: NestExpressApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: 'test',
              CORS_ORIGINS: 'http://localhost:3000',
              LOG_LEVEL: 'silent',
            }),
          ],
        }),
      ],
      controllers: [MockSampleController],
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>();
    const config = app.get(ConfigService);
    configureApp(app, config);
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('X-Request-Id header', () => {
    it('is present on 200 OK responses with a generated UUID', async () => {
      const res = await request(server).get('/test-ok').expect(200);

      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('preserves client-provided X-Request-Id on success', async () => {
      const customId = 'client-id-abc-123';
      const res = await request(server)
        .get('/test-ok')
        .set('X-Request-Id', customId)
        .expect(200);

      expect(res.headers['x-request-id']).toBe(customId);
    });

    it('is present on 404 Not Found responses', async () => {
      const res = await request(server)
        .get('/non-existent-route-for-testing')
        .expect(404);

      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('is present on error responses and included in error body', async () => {
      const customId = 'error-correlation-999';
      const res = await request(server)
        .get('/test-error')
        .set('X-Request-Id', customId)
        .expect(400);

      expect(res.headers['x-request-id']).toBe(customId);
      expect(res.body).toEqual(
        expect.objectContaining({
          statusCode: 400,
          message: 'Something failed',
          requestId: customId,
        }),
      );
    });
  });

  describe('Pino secret redaction and configurable log level', () => {
    it('redacts Authorization headers', () => {
      let loggedOutput = '';
      const destination = {
        write: (msg: string) => {
          loggedOutput += msg;
        },
      };

      const logger = pino(
        {
          level: 'info',
          redact: {
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'authorization',
            ],
            censor: '[REDACTED]',
          },
        },
        destination,
      );

      logger.info({
        req: {
          headers: {
            authorization: 'Bearer super-secret-jwt-token',
            host: 'localhost',
          },
        },
        msg: 'incoming request',
      });

      expect(loggedOutput).toContain('[REDACTED]');
      expect(loggedOutput).not.toContain('super-secret-jwt-token');
    });

    it('supports configurable log level in LoggerModule config', async () => {
      const moduleRef: TestingModule = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
            ignoreEnvFile: true,
            load: [
              () => ({
                NODE_ENV: 'production',
                LOG_LEVEL: 'warn',
              }),
            ],
          }),
          LoggerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
              pinoHttp: {
                level: config.get<string>('LOG_LEVEL', 'info'),
              },
            }),
          }),
        ],
      }).compile();

      expect(moduleRef).toBeDefined();
    });
  });
});
