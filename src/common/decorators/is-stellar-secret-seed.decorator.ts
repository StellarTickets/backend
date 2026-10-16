import { registerDecorator, ValidationOptions } from 'class-validator';
import { StrKey } from '@stellar/stellar-sdk';

/** Validates a Stellar S... ed25519 secret seed using strkey's own checksum, not a regex. */
export function IsStellarSecretSeed(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStellarSecretSeed',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            StrKey.isValidEd25519SecretSeed(value)
          );
        },
        defaultMessage(): string {
          return '$property must be a valid Stellar secret seed (S...)';
        },
      },
    });
  };
}
