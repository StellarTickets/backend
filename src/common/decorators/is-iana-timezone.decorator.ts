import { registerDecorator, ValidationOptions } from 'class-validator';

/** Validates an IANA time-zone identifier with the runtime's Intl database. */
export function IsIanaTimeZone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIanaTimeZone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || value.length === 0) return false;
          try {
            new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(): string {
          return '$property must be a valid IANA time zone';
        },
      },
    });
  };
}
