import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Transform, Type } from 'class-transformer';
import { IsStellarPublicKey } from '../../common/decorators/is-stellar-public-key.decorator';
import { IsSeat } from '../../common/decorators/is-seat.decorator';

function trimSeat(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
export class IssueBatchRecipientDto {
  @IsUUID()
  toUserId!: string;

  /** Recipient wallet; checked before the build-tx call. */
  @IsStellarPublicKey()
  toPublicKey!: string;

  @IsOptional()
  @Transform(({ value }) => trimSeat(value))
  @IsSeat()
  seat?: string;
}

export class IssueBatchDto {
  @IsUUID()
  ticketTypeId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => IssueBatchRecipientDto)
  recipients!: IssueBatchRecipientDto[];
}
