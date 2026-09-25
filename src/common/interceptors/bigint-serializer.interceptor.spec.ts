import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { BigIntSerializerInterceptor } from './bigint-serializer.interceptor';

describe('BigIntSerializerInterceptor', () => {
  let interceptor: BigIntSerializerInterceptor;
  let mockExecutionContext: ExecutionContext;
  let mockCallHandler: CallHandler;

  beforeEach(() => {
    interceptor = new BigIntSerializerInterceptor();
    mockExecutionContext = {} as ExecutionContext;
  });

  it('should serialize bigint to string', (done) => {
    mockCallHandler = {
      handle: () => of({ value: BigInt('12345678901234567890') }),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result.value).toBe('12345678901234567890');
        expect(typeof result.value).toBe('string');
        done();
      });
  });

  it('should serialize nested bigints', (done) => {
    mockCallHandler = {
      handle: () =>
        of({
          price: BigInt('1000000'),
          ticket: { chainTicketId: BigInt('999999') },
        }),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result.price).toBe('1000000');
        expect(result.ticket.chainTicketId).toBe('999999');
        done();
      });
  });

  it('should serialize bigints in arrays', (done) => {
    mockCallHandler = {
      handle: () =>
        of([{ id: BigInt('1') }, { id: BigInt('2') }, { id: BigInt('3') }]),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result[0].id).toBe('1');
        expect(result[1].id).toBe('2');
        expect(result[2].id).toBe('3');
        done();
      });
  });

  it('should handle null and undefined', (done) => {
    mockCallHandler = {
      handle: () =>
        of({
          nullValue: null,
          undefinedValue: undefined,
          normalValue: 'test',
        }),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result.nullValue).toBeNull();
        expect(result.undefinedValue).toBeUndefined();
        expect(result.normalValue).toBe('test');
        done();
      });
  });

  it('should preserve other data types', (done) => {
    mockCallHandler = {
      handle: () =>
        of({
          string: 'hello',
          number: 42,
          boolean: true,
          date: new Date('2026-09-24'),
        }),
    };

    interceptor
      .intercept(mockExecutionContext, mockCallHandler)
      .subscribe((result) => {
        expect(result.string).toBe('hello');
        expect(result.number).toBe(42);
        expect(result.boolean).toBe(true);
        expect(result.date instanceof Date).toBe(true);
        done();
      });
  });

  it('should support JSON.stringify on objects containing BigInt', () => {
    const data = { price: BigInt(5000) };
    expect(JSON.stringify(data)).toBe('{"price":"5000"}');
  });
});
