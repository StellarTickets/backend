import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IssueBatchDto } from './issue-batch.dto';

const UUID = '11111111-1111-4111-8111-111111111111';
const PUBKEY = 'GBAHZWO3UI3GAHPQCPSW6IR5N7HJ4UBRZNAFMSYB6DAKVNHQDOZIV2YJ';

const validRecipient = { toUserId: UUID, toPublicKey: PUBKEY };

describe('IssueBatchDto', () => {
  it('accepts a single recipient without a seat', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: UUID,
      recipients: [validRecipient],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts multiple recipients, some with seats', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: UUID,
      recipients: [
        { ...validRecipient, seat: 'A1' },
        { ...validRecipient, seat: 'A2' },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty recipients array', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: UUID,
      recipients: [],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'recipients')).toBe(true);
  });

  it('rejects a non-UUID ticketTypeId', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: 'not-a-uuid',
      recipients: [validRecipient],
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'ticketTypeId')).toBe(true);
  });

  it('rejects a recipient with an invalid public key', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: UUID,
      recipients: [{ toUserId: UUID, toPublicKey: 'bad-key' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a recipient with an invalid toUserId', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: UUID,
      recipients: [{ toUserId: 'not-a-uuid', toPublicKey: PUBKEY }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a recipient with the reserved "unassigned" seat value', async () => {
    const dto = plainToInstance(IssueBatchDto, {
      ticketTypeId: UUID,
      recipients: [{ ...validRecipient, seat: 'unassigned' }],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
