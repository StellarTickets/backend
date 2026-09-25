import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class ConfirmPurchasePrimaryDto extends ConfirmSignedTxDto {
  @IsUUID()
  ticketTypeId!: string;

  @IsOptional()
  @IsString()
  seat?: string;

  @IsOptional()
  @IsString()
  @Length(3, 32)
  promoCode?: string;
}
