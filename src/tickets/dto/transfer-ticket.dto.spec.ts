import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TransferTicketDto } from './transfer-ticket.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('TransferTicketDto', () => {
  it('accepts a valid UUID', async () => {
    const dto = plainToInstance(TransferTicketDto, { toUserId: UUID });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-UUID toUserId', async () => {
    const dto = plainToInstance(TransferTicketDto, { toUserId: 'nope' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'toUserId')).toBe(true);
  });

  it('rejects a missing toUserId', async () => {
    const dto = plainToInstance(TransferTicketDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'toUserId')).toBe(true);
  });
});
