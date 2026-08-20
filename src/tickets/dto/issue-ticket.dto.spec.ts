import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IssueTicketDto } from './issue-ticket.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('IssueTicketDto', () => {
  it('accepts a payload without a seat', async () => {
    const dto = plainToInstance(IssueTicketDto, {
      ticketTypeId: UUID,
      toUserId: UUID,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a payload with a seat', async () => {
    const dto = plainToInstance(IssueTicketDto, {
      ticketTypeId: UUID,
      toUserId: UUID,
      seat: 'A1',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-UUID ticketTypeId', async () => {
    const dto = plainToInstance(IssueTicketDto, {
      ticketTypeId: 'not-a-uuid',
      toUserId: UUID,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ticketTypeId')).toBe(true);
  });

  it('rejects a non-UUID toUserId', async () => {
    const dto = plainToInstance(IssueTicketDto, {
      ticketTypeId: UUID,
      toUserId: 'nope',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'toUserId')).toBe(true);
  });
});
