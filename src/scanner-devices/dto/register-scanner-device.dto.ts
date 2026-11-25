import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** A Stellar account id: `G` followed by 55 base32 characters. */
export const STELLAR_PUBLIC_KEY = /^G[A-Z2-7]{55}$/;

export class RegisterScannerDeviceDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  /**
   * #515 — the device's own Stellar public key. The device keeps the secret;
   * once the organizer registers this key as a check-in signer, the device
   * signs `check_in` itself.
   */
  @IsOptional()
  @Matches(STELLAR_PUBLIC_KEY, {
    message: 'stellarPublicKey must be a Stellar public key (G...)',
  })
  stellarPublicKey?: string;
}
