import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './auth/guards/roles.guard';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { EventsModule } from './events/events.module';
import { TicketsModule } from './tickets/tickets.module';
import { StellarModule } from './stellar/stellar.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    PrismaModule,
    StellarModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    EventsModule,
    TicketsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // RolesGuard was fully implemented but registered nowhere, so @Roles() was a
    // decorator that silently did nothing -- a security control that looks
    // present in the source and is absent at runtime. Registering it globally is
    // behaviour-neutral today: the guard returns true when a handler carries no
    // @Roles() metadata, and no route currently uses the decorator.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
