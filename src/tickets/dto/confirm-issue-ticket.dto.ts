import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class ConfirmIssueTicketDto extends ConfirmSignedTxDto {
  @IsUUID()
  ticketTypeId: string;

  @IsUUID()
  toUserId: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
