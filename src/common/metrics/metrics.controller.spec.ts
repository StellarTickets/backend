import { Controller, Get, Param } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp } from '../../app.setup';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';

@Controller('events')
class MetricsTestController {
  @Get(':eventId')
  getEvent(@Param('eventId') eventId: string) {
    return { id: eventId };
  }
}

describe('GET /metrics', () => {
  let app: NestExpressApplication;

  afterEach(async () => {
    await app?.close();
  });

  it('requires a bearer token and exposes metrics with templated route labels', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              METRICS_TOKEN: 'm'.repeat(32),
              CORS_ORIGINS: 'http://localhost:3000',
              API_PREFIX: 'api',
            }),
          ],
        }),
        MetricsModule,
      ],
      controllers: [MetricsTestController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, app.get(ConfigService), app.get(MetricsService));
    await app.init();

    const server = app.getHttpServer();
    await request(server).get('/api/v1/events/event-secret-id').expect(200);
    await request(server).get('/api/v1/not-a-route').expect(404);
    await request(server).get('/metrics').expect(401);
    const response = await request(server)
      .get('/metrics')
      .set('Authorization', `Bearer ${'m'.repeat(32)}`)
      .expect(200);

    expect(response.text).toContain(
      'http_requests_total{method="GET",route="/api/v1/events/:param",status_code="200"} 1',
    );
    expect(response.text).toContain(
      'http_requests_total{method="GET",route="unmatched",status_code="404"} 1',
    );
    expect(response.text).not.toContain('event-secret-id');
  });

  it('does not expose metrics when no access token is configured', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              CORS_ORIGINS: 'http://localhost:3000',
            }),
          ],
        }),
        MetricsModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app, app.get(ConfigService), app.get(MetricsService));
    await app.init();

    await request(app.getHttpServer()).get('/metrics').expect(404);
  });
});
