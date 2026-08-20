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
  // Same failure as the resale price field: this flows into BigInt(price), and
  // a non-numeric string throws a bare SyntaxError rather than an
  // HttpException, so Nest answers 500 instead of a 400 naming the field.
  @Matches(/^[1-9]\d*$/, {
    message: 'price must be a positive integer string',
  })
  price: string;

  @IsInt()
  @IsPositive()
  quantityTotal: number;
}
