import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsStellarPublicKey } from '../../common/decorators/is-stellar-public-key.decorator';

export class IssueTicketDto {
  @IsUUID()
  ticketTypeId!: string;

  @IsUUID()
  toUserId!: string;

  /** Recipient wallet; checked before the build-tx call. */
  @IsStellarPublicKey()
  toPublicKey!: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
