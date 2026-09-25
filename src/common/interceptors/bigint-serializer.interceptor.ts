import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

if (
  typeof BigInt.prototype !== 'undefined' &&
  !(BigInt.prototype as any).toJSON
) {
  (BigInt.prototype as any).toJSON = function (this: bigint) {
    return this.toString();
  };
}

/**
 * Serializes BigInt values to strings in JSON responses.
 * Handles nested objects, arrays, and arbitrary deep structures.
 */
@Injectable()
export class BigIntSerializerInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serializeBigInts(data)));
  }

  private serializeBigInts(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'bigint') {
      return value.toString();
    }

    if (value instanceof Date) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.serializeBigInts(item));
    }

    if (typeof value === 'object') {
      const converted: any = {};
      for (const key in value) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          converted[key] = this.serializeBigInts(value[key]);
        }
      }
      return converted;
    }

    return value;
  }
}
