import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsEmail,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/**
 * #386 — bcrypt hashes only the first 72 bytes of its input and silently
 * ignores the rest, so longer passwords are rejected rather than truncated.
 * Measured in UTF-8 bytes, not characters: multi-byte characters count more.
 */
const BCRYPT_MAX_PASSWORD_BYTES = 72;

export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  @IsByteLength(0, BCRYPT_MAX_PASSWORD_BYTES, {
    message: '$property must be at most $constraint2 bytes',
  })
  password!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;
}
