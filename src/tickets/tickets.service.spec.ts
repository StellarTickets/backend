import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// TicketsService only needs StellarService's shape here (it's fully mocked
// below); avoid touching the real @stellar/stellar-sdk import chain, which
// ships ESM-only transitive deps (@noble/hashes, uint8array-extras) that
// Jest can't parse without a much heavier transform config.
jest.mock('../stellar/stellar.service', () => ({ StellarService: jest.fn() }));

import { TicketsService } from './tickets.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrganizationsService } from '../organizations/organizations.service';
import type { StellarService } from '../stellar/stellar.service';

function buildTicketType(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'tt-1',
    name: 'GA',
    price: 1_000n,
    quantityIssued: 0,
    quantityTotal: 100,
    event: {
      id: 'event-1',
      organizationId: 'org-1',
      chainEventId: 42n,
      organization: { stellarAccount: 'GORGANIZER' },
    },
    ...overrides,
  };
}

describe('TicketsService', () => {
  let service: TicketsService;
  let prisma: {
    ticketType: { findUnique: jest.Mock; update: jest.Mock };
    ticket: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    resaleListing: {
      create: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let organizations: { assertMember: jest.Mock };
  let stellar: Record<string, jest.Mock>;

  beforeEach(() => {
    prisma = {
      ticketType: { findUnique: jest.fn(), update: jest.fn() },
      ticket: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      resaleListing: {
        create: jest.fn(),
        updateMany: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    organizations = { assertMember: jest.fn().mockResolvedValue(undefined) };
    stellar = {
      buildIssueTicketTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildPurchasePrimaryTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildTransferTicketTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildCheckInTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildRevokeTicketTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildListForResaleTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildCancelResaleTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      buildBuyResaleTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      submitSignedTransaction: jest
        .fn()
        .mockResolvedValue({ result: 7n, txHash: '0xabc' }),
      verifyTicket: jest.fn(),
    };

    service = new TicketsService(
      prisma as unknown as PrismaService,
      organizations as unknown as OrganizationsService,
      stellar as unknown as StellarService,
    );
  });

  describe('buildIssueTx', () => {
    it('rejects once a ticket type is sold out', async () => {
      prisma.ticketType.findUnique.mockResolvedValue(
        buildTicketType({ quantityIssued: 100, quantityTotal: 100 }),
      );

      await expect(
        service.buildIssueTx('organizer-1', 'tt-1', 'buyer-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stellar.buildIssueTicketTx).not.toHaveBeenCalled();
    });

    it('rejects issuing against an unpublished event', async () => {
      prisma.ticketType.findUnique.mockResolvedValue(
        buildTicketType({
          event: { ...buildTicketType().event, chainEventId: null },
        }),
      );

      await expect(
        service.buildIssueTx('organizer-1', 'tt-1', 'buyer-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('requires the recipient to have a connected wallet', async () => {
      prisma.ticketType.findUnique.mockResolvedValue(buildTicketType());
      prisma.user.findUnique.mockResolvedValue({
        id: 'buyer-1',
        stellarPublicKey: null,
      });

      await expect(
        service.buildIssueTx('organizer-1', 'tt-1', 'buyer-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('builds an issue_ticket transaction against the organizer account', async () => {
      prisma.ticketType.findUnique.mockResolvedValue(buildTicketType());
      prisma.user.findUnique.mockResolvedValue({
        id: 'buyer-1',
        stellarPublicKey: 'GBUYER',
      });

      const { unsignedXdr } = await service.buildIssueTx(
        'organizer-1',
        'tt-1',
        'buyer-1',
        'A1',
      );

      expect(unsignedXdr).toBe('unsigned-xdr');
      expect(organizations.assertMember).toHaveBeenCalledWith(
        'org-1',
        'organizer-1',
      );
      expect(stellar.buildIssueTicketTx).toHaveBeenCalledWith({
        organizerPublicKey: 'GORGANIZER',
        chainEventId: 42n,
        toPublicKey: 'GBUYER',
        tier: 'GA',
        seat: 'A1',
        price: 1_000n,
      });
    });
  });

  describe('confirmIssue', () => {
    it('creates the ticket row and increments quantityIssued using the on-chain ticket id', async () => {
      prisma.ticketType.findUnique.mockResolvedValue(buildTicketType());
      prisma.ticket.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'ticket-1', ...data }),
      );

      const ticket = await service.confirmIssue(
        'organizer-1',
        'tt-1',
        'buyer-1',
        'A1',
        'signed-xdr',
      );

      expect(stellar.submitSignedTransaction).toHaveBeenCalledWith(
        'signed-xdr',
      );
      expect(prisma.ticketType.update).toHaveBeenCalledWith({
        where: { id: 'tt-1' },
        data: { quantityIssued: { increment: 1 } },
      });
      expect(ticket).toMatchObject({
        chainTicketId: 7n,
        ownerId: 'buyer-1',
        seat: 'A1',
      });
    });
  });

  describe('transfer', () => {
    it('refuses to build a transfer for a ticket the caller does not own', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        ownerId: 'someone-else',
        chainTicketId: 7n,
        event: {
          organizationId: 'org-1',
          organization: { stellarAccount: 'GORG' },
        },
      });

      await expect(
        service.buildTransferTx('not-the-owner', 'ticket-1', 'friend-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('builds a transfer using both parties on-chain public keys', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        ownerId: 'owner-1',
        chainTicketId: 7n,
        event: {
          organizationId: 'org-1',
          organization: { stellarAccount: 'GORG' },
        },
      });
      prisma.user.findUnique
        .mockResolvedValueOnce({ id: 'owner-1', stellarPublicKey: 'GOWNER' })
        .mockResolvedValueOnce({ id: 'friend-1', stellarPublicKey: 'GFRIEND' });

      await service.buildTransferTx('owner-1', 'ticket-1', 'friend-1');

      expect(stellar.buildTransferTicketTx).toHaveBeenCalledWith({
        fromPublicKey: 'GOWNER',
        chainTicketId: 7n,
        toPublicKey: 'GFRIEND',
      });
    });
  });

  describe('verify', () => {
    it('reconciles the cached status when it diverges from the chain', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        chainTicketId: 7n,
        status: 'VALID',
        seat: 'A1',
        event: { organizationId: 'org-1', name: 'Radiohead Live' },
        owner: { name: 'Ada Lovelace' },
        ticketType: { name: 'GA' },
      });
      stellar.verifyTicket.mockResolvedValue({
        owner: 'GBUYER',
        status: 'Used',
      });

      const result = await service.verify('staff-1', 'qr-secret-abc');

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: 'USED' },
      });
      expect(result.status).toBe('USED');
      expect(result.eventName).toBe('Radiohead Live');
    });

    it('throws when no ticket matches the scanned secret', async () => {
      prisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        service.verify('staff-1', 'unknown-secret'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resale marketplace', () => {
    it('rejects buying a ticket that is not listed for resale', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        status: 'VALID',
        chainTicketId: 7n,
        event: {
          organizationId: 'org-1',
          organization: { stellarAccount: 'GORG' },
        },
      });

      await expect(
        service.buildBuyResaleTx('buyer-1', 'ticket-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates an active resale listing on confirm', async () => {
      prisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket-1',
        ownerId: 'owner-1',
        chainTicketId: 7n,
        event: {
          organizationId: 'org-1',
          organization: { stellarAccount: 'GORG' },
        },
      });
      prisma.resaleListing.create.mockResolvedValue({
        id: 'listing-1',
        status: 'ACTIVE',
      });

      await service.confirmListForResale(
        'owner-1',
        'ticket-1',
        '1200',
        'signed-xdr',
      );

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { status: 'RESALE' },
      });
      expect(prisma.resaleListing.create).toHaveBeenCalledWith({
        data: {
          ticketId: 'ticket-1',
          sellerId: 'owner-1',
          price: 1200n,
          txHash: '0xabc',
        },
      });
    });
  });
});
