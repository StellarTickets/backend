import { registerDecorator, ValidationOptions } from 'class-validator';
import { isBase64 } from 'class-validator';

/**
 * Upper bound on a base64-encoded signed transaction envelope. Real Soroban
 * envelopes built by this service are a few KB at most; this just keeps an
 * obviously-wrong or abusive payload from ever reaching
 * `TransactionBuilder.fromXDR`, which has no size limit of its own.
 */
export const SIGNED_XDR_MAX_LENGTH = 64 * 1024;

/**
 * Validates that a wallet-signed XDR envelope is well-formed base64 within a
 * sane size bound, before it ever reaches `TransactionBuilder.fromXDR`. This
 * does not guarantee the bytes decode to a valid transaction envelope -- that
 * still happens, and can still fail, downstream -- but it rejects the common
 * case (empty string, plain text, a public key, truncated/garbled input)
 * with a 400 at the validation layer instead of a 500 from a thrown parse
 * error deep in `StellarService`.
 */
export function IsSignedXdr(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSignedXdr',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            value.length > 0 &&
            value.length <= SIGNED_XDR_MAX_LENGTH &&
            isBase64(value)
          );
        },
        defaultMessage(): string {
          return `$property must be a base64-encoded transaction envelope of at most ${SIGNED_XDR_MAX_LENGTH} characters`;
        },
      },
    });
  };
}
