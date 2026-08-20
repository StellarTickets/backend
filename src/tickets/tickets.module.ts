import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StellarModule } from '../stellar/stellar.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [OrganizationsModule, StellarModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
