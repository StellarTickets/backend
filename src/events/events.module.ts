import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StellarModule } from '../stellar/stellar.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventReminderService } from './event-reminder.service';

@Module({
  imports: [OrganizationsModule, StellarModule],
  controllers: [EventsController],
  providers: [EventsService, EventReminderService],
  exports: [EventsService, EventReminderService],
})
export class EventsModule {}
