import { IsString } from 'class-validator';

export class ListForResaleDto {
  /** Asking price in the settlement token's smallest unit, as a string to preserve i128 precision. */
  @IsString()
  price: string;
}
