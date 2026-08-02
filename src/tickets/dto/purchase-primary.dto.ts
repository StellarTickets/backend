import { IsOptional, IsString, IsUUID } from 'class-validator';

export class PurchasePrimaryDto {
  @IsUUID()
  ticketTypeId: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
