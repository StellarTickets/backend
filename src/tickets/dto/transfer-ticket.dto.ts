import { IsUUID } from 'class-validator';

export class TransferTicketDto {
  @IsUUID()
  toUserId: string;
}
