import { IsOptional, IsString, IsUUID } from 'class-validator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class ConfirmPurchasePrimaryDto extends ConfirmSignedTxDto {
  @IsUUID()
  ticketTypeId: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
