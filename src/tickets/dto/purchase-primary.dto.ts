import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class PurchasePrimaryDto {
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
