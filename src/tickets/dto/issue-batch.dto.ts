import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsStellarPublicKey } from '../../common/decorators/is-stellar-public-key.decorator';
import { IsSeat } from '../../common/decorators/is-seat.decorator';

export class IssueBatchRecipientDto {
  @IsUUID()
  toUserId!: string;

  /** Recipient wallet; checked before the build-tx call. */
  @IsStellarPublicKey()
  toPublicKey!: string;

  @IsOptional()
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
