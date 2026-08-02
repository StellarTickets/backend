import { IsOptional, IsString, IsUUID } from 'class-validator';

export class IssueTicketDto {
  @IsUUID()
  ticketTypeId: string;

  @IsUUID()
  toUserId: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
