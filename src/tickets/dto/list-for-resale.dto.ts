import { IsString, Matches } from 'class-validator';

export class ListForResaleDto {
  /** Asking price in the settlement token's smallest unit, as a string to preserve i128 precision. */
  @IsString()
  @Matches(/^[1-9]\d*$/, { message: 'price must be a positive integer string' })
  price: string;
}
