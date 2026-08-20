import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

/**
 * Validates that this date property is strictly later than another property on
 * the same object. Undefined values pass so the check composes with
 * `@IsOptional()` -- presence is that decorator's job, ordering is this one's.
 */
export function IsAfter(property: string, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isAfter',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const other = (args.object as Record<string, unknown>)[
            args.constraints[0] as string
          ];
          if (value === undefined || other === undefined) return true;
          const a = new Date(value as string).getTime();
          const b = new Date(other as string).getTime();
          // An unparseable date is @IsDateString()'s error to report, not ours;
          // failing here too would surface two messages for one mistake.
          if (Number.isNaN(a) || Number.isNaN(b)) return true;
          return a > b;
        },
        defaultMessage(args: ValidationArguments): string {
          return `$property must be after ${args.constraints[0] as string}`;
        },
      },
    });
  };
}
