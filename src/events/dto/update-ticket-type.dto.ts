import { IsInt, IsPositive } from 'class-validator';

export class UpdateTicketTypeDto {
  @IsInt()
  @IsPositive()
  quantityTotal!: number;
}
