import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RefundsService } from './refunds.service';

describe('RefundsService (#141)', () => {
  let prisma: {
    ticket: { findUnique: jest.Mock };
    refund: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let service: RefundsService;

  beforeEach(() => {
    prisma = {
      ticket: { findUnique: jest.fn() },
      refund: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    service = new RefundsService(prisma as never);
  });

  it('creates a refund only for a REVOKED ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'REVOKED' });
    prisma.refund.create.mockResolvedValue({ id: 'r1', ticketId: 't1', status: 'PENDING' });

    const result = await service.create('t1');

    expect(prisma.refund.create).toHaveBeenCalledWith({ data: { ticketId: 't1' } });
    expect(result.status).toBe('PENDING');
  });

  it('rejects a refund for a non-REVOKED ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue({ id: 't1', status: 'VALID' });

    await expect(service.create('t1')).rejects.toThrow(BadRequestException);
    expect(prisma.refund.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown ticket', async () => {
    prisma.ticket.findUnique.mockResolvedValue(null);

    await expect(service.create('missing')).rejects.toThrow(NotFoundException);
  });
});
