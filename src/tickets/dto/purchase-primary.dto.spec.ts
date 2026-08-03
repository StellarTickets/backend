import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PurchasePrimaryDto } from './purchase-primary.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('PurchasePrimaryDto', () => {
  it('accepts a payload without a seat', async () => {
    const dto = plainToInstance(PurchasePrimaryDto, { ticketTypeId: UUID });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a payload with a seat', async () => {
    const dto = plainToInstance(PurchasePrimaryDto, {
      ticketTypeId: UUID,
      seat: 'B12',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-UUID ticketTypeId', async () => {
    const dto = plainToInstance(PurchasePrimaryDto, { ticketTypeId: 'nope' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ticketTypeId')).toBe(true);
  });
});
