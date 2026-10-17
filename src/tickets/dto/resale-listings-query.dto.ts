import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export enum ResaleSortBy {
  CREATED_AT = 'createdAt',
  PRICE = 'price',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/** Filter and pagination query for `GET /tickets/resale`. */
export class ResaleListingsQueryDto {
  /** Opaque cursor from a previous response's `nextCursor`. */
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  /** Sort field (Issue #117) */
  @IsOptional()
  @IsEnum(ResaleSortBy)
  sortBy?: ResaleSortBy = ResaleSortBy.CREATED_AT;

  /** Sort direction (Issue #117) */
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  /** Filter by event ID (Issue #119) */
  @IsOptional()
  @IsString()
  eventId?: string;

  /** Filter by minimum price in stroops or units (Issue #119) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  /** Filter by maximum price in stroops or units (Issue #119) */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}
