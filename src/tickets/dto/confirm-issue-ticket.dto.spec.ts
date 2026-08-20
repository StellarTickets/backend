import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmIssueTicketDto } from './confirm-issue-ticket.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('ConfirmIssueTicketDto', () => {
  it('accepts a well-formed payload', async () => {
    const dto = plainToInstance(ConfirmIssueTicketDto, {
      ticketTypeId: UUID,
      toUserId: UUID,
      signedXdr: 'AAAAAgAAAAA=',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a payload missing signedXdr', async () => {
    const dto = plainToInstance(ConfirmIssueTicketDto, {
      ticketTypeId: UUID,
      toUserId: UUID,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'signedXdr')).toBe(true);
  });
});
