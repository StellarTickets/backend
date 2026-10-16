import { Transform } from 'class-transformer';

/**
 * Trims leading/trailing whitespace from a string field before any
 * `class-validator` check runs on it, so e.g. `MinLength`/`MaxLength` see the
 * trimmed value and `"  Name "` doesn't produce a duplicate-looking record
 * next to `"Name"`.
 */
export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
