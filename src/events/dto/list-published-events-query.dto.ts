import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Industry } from '@prisma/client';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

/** Rejects a `to` that falls before the sibling `from`, if both are set. */
function IsNotBefore(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isNotBefore',
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: {
        message: `${propertyName} must not be before ${property}`,
        ...options,
      },
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const other = (args.object as Record<string, unknown>)[property];
          if (!(value instanceof Date) || !(other instanceof Date)) {
            return true;
          }
          return value.getTime() >= other.getTime();
        },
      },
    });
  };
}

/**
 * Filters and pagination for the public `GET /events` listing. Every filter
 * is optional and they combine with AND.
 */
export class ListPublishedEventsQueryDto extends PaginationQueryDto {
  /** Case-insensitive substring match against the event name or venue. */
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @IsOptional()
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: Industry })
  @IsOptional()
  @IsEnum(Industry, {
    message: `category must be one of: ${Object.values(Industry).join(', ')}`,
  })
  category?: Industry;

  /** Only events starting at or after this instant (ISO 8601). */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'from must be an ISO 8601 date' })
  from?: Date;

  /** Only events starting at or before this instant (ISO 8601). */
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'to must be an ISO 8601 date' })
  @IsNotBefore('from')
  to?: Date;
}
