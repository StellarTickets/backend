import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { FeatureFlagsModule } from './config/feature-flags.module';
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
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';
import { RequestTimeoutInterceptor } from './common/interceptors/request-timeout.interceptor';
import { DomainExceptionFilter } from './common/filters/domain-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    // Reads SCHEDULER_ENABLED from process.env, so it must follow ConfigModule.
    SchedulerModule.forRoot(),
    CacheModule,
    WebhooksModule,
    FeatureFlagsModule,
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
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: BigIntSerializerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestTimeoutInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: DomainExceptionFilter,
    },
  ],
})
export class AppModule {}
