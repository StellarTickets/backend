import { IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class UpdateProfileDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;
}
