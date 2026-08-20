import { IsString, Matches } from 'class-validator';

export class ListForResaleDto {
  /** Asking price in the settlement token's smallest unit, as a string to preserve i128 precision. */
  @IsString()
  // The value flows into BigInt(price) downstream. A non-numeric string makes
  // BigInt throw a plain SyntaxError, which is not an HttpException, so Nest
  // answers 500 instead of a 400 naming the offending field. Validate at the
  // boundary rather than letting a parse error surface as a server fault.
  @Matches(/^[1-9]\d*$/, {
    message: 'price must be a positive integer string',
  })
  price: string;
}
