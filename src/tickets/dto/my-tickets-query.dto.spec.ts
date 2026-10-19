import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MyTicketsQueryDto } from './my-tickets-query.dto';

describe('MyTicketsQueryDto', () => {
  it('accepts an empty query', async () => {
    const dto = plainToInstance(MyTicketsQueryDto, {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it.each(['VALID', 'USED', 'REVOKED', 'RESALE'])(
    'accepts status %s',
    async (status) => {
      const dto = plainToInstance(MyTicketsQueryDto, { status });
      expect(await validate(dto)).toHaveLength(0);
    },
  );

  it.each(['valid', 'EXPIRED', ''])('rejects status %p', async (status) => {
    const dto = plainToInstance(MyTicketsQueryDto, { status });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'status')).toBe(true);
  });
});
