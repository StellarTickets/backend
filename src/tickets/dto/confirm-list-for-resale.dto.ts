import { IsString } from 'class-validator';
import { ConfirmSignedTxDto } from './confirm-signed-tx.dto';

export class ConfirmListForResaleDto extends ConfirmSignedTxDto {
  @IsString()
  price: string;
}
