import { IsUUID } from 'class-validator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class ConfirmTransferTicketDto extends ConfirmSignedTxDto {
  @IsUUID()
  toUserId: string;
}
