import { IsString, MinLength } from 'class-validator';

export class CreateGateDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
