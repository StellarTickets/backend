import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validate } from './config/env.validation';
import { FeatureFlagsModule } from './config/feature-flags.module';
import { SecretsModule } from './config/secrets/secrets.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { StellarModule } from './stellar/stellar.module';
import { NotificationsModule } from './notifications/notifications.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { GatesModule } from './gates/gates.module';
import { ScannerDevicesModule } from './scanner-devices/scanner-devices.module';
import { PendingTxModule } from './pending-tx/pending-tx.module';
import { AuditModule } from './audit/audit.module';
import { CacheModule } from './common/cache/cache.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RefundsModule } from './refunds/refunds.module';
import { TracingShutdownService } from './tracing';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';
import { RequestTimeoutInterceptor } from './common/interceptors/request-timeout.interceptor';
import { RequestLoggingInterceptor } from './common/interceptors/request-logging.interceptor';

import { HealthModule } from './health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';

@Module({
  imports: [
    HealthModule,
    RefundsModule,
    MetricsModule,
    ConfigModule.forRoot({ isGlobal: true, validate }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const isTest = config.get<string>('NODE_ENV') === 'test';
        const defaultLevel = isTest ? 'silent' : isProd ? 'info' : 'debug';
        const level = config.get<string>('LOG_LEVEL', defaultLevel);

        return {
          pinoHttp: {
            level,
            genReqId: (req: IncomingMessage, res: ServerResponse) => {
              const existing = req.headers['x-request-id'];
              const id =
                typeof existing === 'string' && existing.trim().length > 0
                  ? existing.trim()
                  : Array.isArray(existing) && existing[0]
                    ? existing[0]
                    : randomUUID();
              res.setHeader('X-Request-Id', id);
              return id;
            },
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["x-api-key"]',
                'req.headers["authorization"]',
                'authorization',
                'headers.authorization',
              ],
              censor: '[REDACTED]',
            },
            autoLogging: !isTest,
          },
        };
      },
    }),
    // Reads SCHEDULER_ENABLED from process.env, so it must follow ConfigModule.
    SchedulerModule.forRoot(),
    CacheModule,
    WebhooksModule,
    FeatureFlagsModule,
    SecretsModule.forRoot(),
    PrismaModule,
    StellarModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    EventsModule,
    TicketsModule,
    NotificationsModule,
    WaitlistModule,
    PromoCodesModule,
    GatesModule,
    ScannerDevicesModule,
    PendingTxModule,
    AuditModule,
  ],
  providers: [
    TracingShutdownService,
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimeoutInterceptor,
    },
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
