import { ExecutionContext, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { TEST_USER } from '../../test/helpers/controller-app';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScanRateLimitGuard } from '../common/guards/scan-rate-limit.guard';
import { IdempotencyInterceptor } from '../common/interceptors/idempotency.interceptor';
import { MemoryRateLimitStore } from '../common/rate-limit/memory-rate-limit.store';
import { RATE_LIMIT_STORE } from '../common/rate-limit/rate-limit-store';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

const LIMIT = 3;

/**
 * Drives GET /tickets/verify/:qrSecret over real HTTP with the real
 * ScanRateLimitGuard (the controller spec stubs it out), so it proves the
 * route is actually bound to the limiter and answers 429 past the limit (#131).
 * Every request comes from the same loopback IP, so these cases exercise the
 * per-IP limit; the per-secret limit is covered in scan-rate-limit.guard.spec.ts.
 */
describe('GET /tickets/verify/:qrSecret rate limiting (#131)', () => {
  let app: INestApplication;
  const service = { verify: jest.fn() };

  beforeEach(async () => {
    service.verify.mockReset();
    service.verify.mockResolvedValue({ valid: true });

    const moduleRef = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        { provide: TicketsService, useValue: service },
        ScanRateLimitGuard,
        { provide: RATE_LIMIT_STORE, useValue: new MemoryRateLimitStore() },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: number) =>
              key === 'SCAN_RATE_LIMIT_MAX' ? LIMIT : fallback,
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest<{ user?: unknown }>().user =
            TEST_USER;
          return true;
        },
      })
      .overrideInterceptor(IdempotencyInterceptor)
      .useValue({
        intercept: (_: unknown, next: { handle(): unknown }) => next.handle(),
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(() => app.close());

  const get = (qrSecret: string) =>
    request(app.getHttpServer() as App).get(`/tickets/verify/${qrSecret}`);

  it('answers 429 once the limit is exceeded, without reaching the handler', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await get('secret-a').expect(200);
    }

    const res = await get('secret-a').expect(429);

    expect((res.body as { message: string }).message).toMatch(
      /Too many verification attempts/,
    );
    expect(service.verify).toHaveBeenCalledTimes(LIMIT);
  });

  it('still answers 429 when every scan uses a different secret', async () => {
    for (let i = 0; i < LIMIT; i++) {
      await get(`secret-${i}`).expect(200);
    }

    await get('secret-new').expect(429);
    expect(service.verify).toHaveBeenCalledTimes(LIMIT);
  });
});
