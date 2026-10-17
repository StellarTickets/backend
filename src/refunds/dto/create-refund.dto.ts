import { IsString } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  ticketId!: string;
}
