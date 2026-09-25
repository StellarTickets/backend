import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';
import { IsBigIntString } from '../../common/decorators/is-bigint-string.decorator';

export class CreateTicketTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  /** Face-value price in the settlement token's smallest unit, as a string to preserve i128 precision over JSON. */
  @IsBigIntString()
  price!: string;

  @IsInt()
  @IsPositive()
  quantityTotal!: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleStartsAt?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  saleEndsAt?: Date;
  @IsOptional()
  isHidden?: boolean;
}
