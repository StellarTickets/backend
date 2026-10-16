import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { UNASSIGNED_SEAT } from '../constants/seat.constant';

@ValidatorConstraint({ name: 'isSeat', async: false })
export class IsSeatConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    if (value.length === 0 || value.length > 64) return false;
    // Reserved for "no seat assigned" — a real seat can never collide with it.
    if (value.toLowerCase() === UNASSIGNED_SEAT) return false;
    // Allow alphanumeric, spaces, and common seat characters (-, /, .)
    return /^[a-zA-Z0-9\s\-/.]+$/.test(value) && !/^\s+$/.test(value);
  }

  defaultMessage(): string {
    return `seat must be 1-64 characters, alphanumeric with spaces, hyphens, slashes, or periods only, and cannot be "${UNASSIGNED_SEAT}"`;
  }
}

export function IsSeat(validationOptions?: ValidationOptions) {
  return function (target: object, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsSeatConstraint,
    });
  };
}
