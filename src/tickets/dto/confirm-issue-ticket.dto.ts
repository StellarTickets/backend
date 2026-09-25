import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsStellarPublicKey } from '../../common/decorators/is-stellar-public-key.decorator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class ConfirmIssueTicketDto extends ConfirmSignedTxDto {
  @IsUUID()
  ticketTypeId!: string;

  @IsUUID()
  toUserId!: string;

  @IsStellarPublicKey()
  toPublicKey!: string;

  @IsOptional()
  @IsString()
  seat?: string;
}
