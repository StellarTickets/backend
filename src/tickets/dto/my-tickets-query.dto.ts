import { TicketStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

/** Optional status filter for `GET /tickets/mine`. */
export class MyTicketsQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;
}
