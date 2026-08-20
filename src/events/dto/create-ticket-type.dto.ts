import {
  IsInt,
  IsPositive,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateTicketTypeDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Face-value price in the settlement token's smallest unit, as a string to preserve i128 precision over JSON. */
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'price must be a positive integer string' })
  price: string;

  @IsInt()
  @IsPositive()
  quantityTotal: number;
}
