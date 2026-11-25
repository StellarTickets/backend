import { Transform } from 'class-transformer';
import { IsOptional, IsUUID } from 'class-validator';
import { IsStellarPublicKey } from '../../common/decorators/is-stellar-public-key.decorator';
import { IsSeat } from '../../common/decorators/is-seat.decorator';

function trimSeat(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
export class IssueTicketDto {
  @IsUUID()
  ticketTypeId!: string;

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
