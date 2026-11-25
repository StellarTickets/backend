import { IsOptional, IsUUID } from 'class-validator';

export class BuildCheckInDto {
  @IsOptional()
  @IsUUID()
  gateId?: string;
}
