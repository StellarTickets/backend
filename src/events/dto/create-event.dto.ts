import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinDate,
  MinLength,
} from 'class-validator';
import { Industry } from '@prisma/client';

/**
 * How far in the past `startsAt` may be before it's rejected. Absorbs client
 * clock skew and the time between a form being filled and submitted, so an
 * event starting "now" isn't bounced.
 */
export const STARTS_AT_PAST_TOLERANCE_MS = 60_000;

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(Industry, {
    message: `category must be one of: ${Object.values(Industry).join(', ')}`,
  })
  category!: Industry;

  @IsString()
  @MinLength(1)
  venue!: string;

  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(Date.now() - STARTS_AT_PAST_TOLERANCE_MS), {
    message: 'startsAt must not be in the past',
  })
  startsAt!: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  /** Basis points cap on resale price relative to face value (10000 = 100%). */
  @IsOptional()
  @IsInt()
  @Min(10_000)
  @Max(50_000)
  maxResaleMultiplierBps?: number;

  /** Basis points of every resale paid to the organizer as royalty. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2_000)
  royaltyBps?: number;
}
