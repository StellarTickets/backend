import { registerDecorator, ValidationOptions } from 'class-validator';
import { StrKey } from '@stellar/stellar-sdk';

/** Validates a Stellar G... ed25519 public key using strkey's own checksum, not a regex. */
export function IsStellarPublicKey(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStellarPublicKey',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' && StrKey.isValidEd25519PublicKey(value)
          );
        },
        defaultMessage(): string {
          return '$property must be a valid Stellar public key (G...)';
        },
      },
    });
  };
}
