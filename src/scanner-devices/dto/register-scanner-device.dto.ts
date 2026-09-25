import { IsString, MinLength } from 'class-validator';

export class RegisterScannerDeviceDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
