import { registerDecorator, ValidationOptions } from 'class-validator';
import { StrKey } from '@stellar/stellar-sdk';

/** Validates a Stellar C... contract address using strkey's own checksum, not a regex. */
export function IsStellarContractId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isStellarContractId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && StrKey.isValidContract(value);
        },
        defaultMessage(): string {
          return '$property must be a valid Stellar contract id (C...)';
        },
      },
    });
  };
}
