import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import type { SchedulerRegistry } from '@nestjs/schedule';
import { TicketStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { StellarService } from '../stellar/stellar.service';
import {
  DEFAULT_TICKET_RECONCILIATION_INTERVAL_MINUTES,
  TicketStatusReconciliationJob,
  ticketReconciliationIntervalMs,
} from './ticket-status-reconciliation.job';

describe('ticketReconciliationIntervalMs', () => {
  it('defaults to 60 minutes', () => {
    expect(ticketReconciliationIntervalMs({})).toBe(
      DEFAULT_TICKET_RECONCILIATION_INTERVAL_MINUTES * 60_000,
    );
  });

  it('uses a valid configured minute interval', () => {
    expect(
      ticketReconciliationIntervalMs({
        TICKET_RECONCILIATION_INTERVAL_MINUTES: '5',
      }),
    ).toBe(5 * 60_000);
  });

  it.each(['0', '1.5', '1441', 'invalid'])(
    'rejects an invalid interval %p',
    (value) => {
      expect(() =>
        ticketReconciliationIntervalMs({
          TICKET_RECONCILIATION_INTERVAL_MINUTES: value,
        }),
      ).toThrow(/must be an integer from 1 to 1440/);
    },
  );
});

describe('TicketStatusReconciliationJob', () => {
  let job: TicketStatusReconciliationJob;
  let prisma: {
    ticket: { findMany: jest.Mock; updateMany: jest.Mock };
    user: { findUnique: jest.Mock };
  };
  let stellar: { verifyTicket: jest.Mock };
  let scheduler: {
    addInterval: jest.Mock;
    doesExist: jest.Mock;
    deleteInterval: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      ticket: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: { findUnique: jest.fn() },
    };
    stellar = { verifyTicket: jest.fn() };
    scheduler = {
      addInterval: jest.fn(),
      doesExist: jest.fn().mockReturnValue(false),
      deleteInterval: jest.fn(),
    };
    job = new TicketStatusReconciliationJob(
      prisma as unknown as PrismaService,
      stellar as unknown as StellarService,
      scheduler as unknown as SchedulerRegistry,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('registers its recurring interval and removes it at shutdown', () => {
    jest.useFakeTimers();
    job.onModuleInit();

    expect(scheduler.addInterval).toHaveBeenCalledWith(
      'ticket-status-reconciliation',
      expect.anything(),
    );

    scheduler.doesExist.mockReturnValue(true);
    job.onModuleDestroy();
    expect(scheduler.deleteInterval).toHaveBeenCalledWith(
      'ticket-status-reconciliation',
    );
  });

  it('repairs drift and reports checked, repaired, and failed counts', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-drifted',
        chainTicketId: 1n,
        status: TicketStatus.VALID,
        ownerId: 'owner-1',
        owner: { stellarPublicKey: 'GOWNER1' },
      },
      {
        id: 'ticket-current',
        chainTicketId: 2n,
        status: TicketStatus.USED,
        ownerId: 'owner-1',
        owner: { stellarPublicKey: 'GOWNER1' },
      },
      {
        id: 'ticket-failed',
        chainTicketId: 3n,
        status: TicketStatus.VALID,
        ownerId: 'owner-1',
        owner: { stellarPublicKey: 'GOWNER1' },
      },
    ]);
    stellar.verifyTicket
      .mockResolvedValueOnce({ status: 'Used', owner: 'GOWNER1' })
      .mockResolvedValueOnce({ status: 'Used', owner: 'GOWNER1' })
      .mockRejectedValueOnce(new Error('RPC unavailable'));

    await expect(job.reconcileOnce()).resolves.toEqual({
      checked: 3,
      drifted: 1,
      repaired: 1,
      raced: 0,
      failed: 1,
    });
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ticket-drifted',
        status: TicketStatus.VALID,
        ownerId: 'owner-1',
      },
      data: { status: TicketStatus.USED },
    });
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('checked=3, drifted=1, repaired=1'),
    );
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('ticket-failed'),
      expect.any(String),
    );
  });

  it('repairs owner drift when the chain wallet belongs to a known user', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-owner-drifted',
        chainTicketId: 4n,
        status: TicketStatus.VALID,
        ownerId: 'stale-owner',
        owner: { stellarPublicKey: 'GOLDOWNER' },
      },
    ]);
    stellar.verifyTicket.mockResolvedValue({
      status: 'Valid',
      owner: 'GNEWOWNER',
    });
    prisma.user.findUnique.mockResolvedValue({ id: 'chain-owner' });

    await expect(job.reconcileOnce()).resolves.toEqual({
      checked: 1,
      drifted: 1,
      repaired: 1,
      raced: 0,
      failed: 0,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { stellarPublicKey: 'GNEWOWNER' },
      select: { id: true },
    });
    expect(prisma.ticket.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'ticket-owner-drifted',
        status: TicketStatus.VALID,
        ownerId: 'stale-owner',
      },
      data: { ownerId: 'chain-owner' },
    });
  });

  it('does not replace the owner when the chain wallet is not a known user', async () => {
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-unknown-owner',
        chainTicketId: 5n,
        status: TicketStatus.VALID,
        ownerId: 'current-owner',
        owner: { stellarPublicKey: 'GCURRENT' },
      },
    ]);
    stellar.verifyTicket.mockResolvedValue({
      status: 'Valid',
      owner: 'GUNKNOWN',
    });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(job.reconcileOnce()).resolves.toMatchObject({
      checked: 1,
      drifted: 0,
      repaired: 0,
      raced: 0,
      failed: 0,
    });
    expect(prisma.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('does not overwrite a status changed since the ticket was read', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    prisma.ticket.findMany.mockResolvedValue([
      {
        id: 'ticket-raced',
        chainTicketId: 7n,
        status: TicketStatus.VALID,
        ownerId: 'owner-1',
        owner: { stellarPublicKey: 'GOWNER1' },
      },
    ]);
    stellar.verifyTicket.mockResolvedValue({
      status: 'Used',
      owner: 'GOWNER1',
    });
    prisma.ticket.updateMany.mockResolvedValue({ count: 0 });

    await expect(job.reconcileOnce()).resolves.toMatchObject({
      checked: 1,
      drifted: 1,
      repaired: 0,
      raced: 1,
      failed: 0,
    });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('changed during reconciliation'),
    );
  });
});
