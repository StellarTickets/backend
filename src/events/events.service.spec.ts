import { BadRequestException, ConflictException } from '@nestjs/common';

// See tickets.service.spec.ts for why StellarService is mocked at the
// module level rather than imported for real.
jest.mock('../stellar/stellar.service', () => ({ StellarService: jest.fn() }));

import { EventsService } from './events.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { OrganizationsService } from '../organizations/organizations.service';
import type { StellarService } from '../stellar/stellar.service';

describe('EventsService', () => {
  let service: EventsService;
  let prisma: {
    event: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
    };
    ticket: { count: jest.Mock };
    ticketType: { count: jest.Mock };
  };
  let organizations: { assertMember: jest.Mock };
  let stellar: {
    buildCreateEventTx: jest.Mock;
    submitSignedTransaction: jest.Mock;
    getEvent: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      event: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      ticket: { count: jest.fn() },
      ticketType: { count: jest.fn().mockResolvedValue(1) },
    };
    organizations = { assertMember: jest.fn().mockResolvedValue(undefined) };
    stellar = {
      buildCreateEventTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      submitSignedTransaction: jest
        .fn()
        .mockResolvedValue({ result: null, txHash: '0xabc' }),
      getEvent: jest.fn().mockResolvedValue({
        eventId: 99n,
        organizer: 'GORG',
      }),
    };

    service = new EventsService(
      prisma as unknown as PrismaService,
      organizations as unknown as OrganizationsService,
      stellar as unknown as StellarService,
    );
  });

  describe('buildPublishTx', () => {
    it('refuses to publish an already-published event', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        status: 'PUBLISHED',
        chainEventId: null,
        organization: { stellarAccount: 'GORG' },
      });

      await expect(
        service.buildPublishTx('organizer-1', 'event-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(stellar.buildCreateEventTx).not.toHaveBeenCalled();
    });

    it('refuses to re-publish an event that already reserved an on-chain id', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        status: 'DRAFT',
        chainEventId: 99n,
        organization: { stellarAccount: 'GORG' },
      });

      await expect(
        service.buildPublishTx('organizer-1', 'event-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns conflict when the event has no ticket types to sell', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        status: 'DRAFT',
        chainEventId: null,
        organization: { stellarAccount: 'GORG' },
      });
      prisma.ticketType.count.mockResolvedValue(0);

      const attempt = service.buildPublishTx('organizer-1', 'event-1');

      await expect(attempt).rejects.toBeInstanceOf(ConflictException);
      await expect(attempt).rejects.toMatchObject({ status: 409 });
      expect(prisma.ticketType.count).toHaveBeenCalledWith({
        where: { eventId: 'event-1' },
      });
      expect(prisma.event.update).not.toHaveBeenCalled();
      expect(stellar.buildCreateEventTx).not.toHaveBeenCalled();
    });

    it('reserves a chain event id and builds create_event against the org account', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        status: 'DRAFT',
        chainEventId: null,
        name: 'Radiohead Live',
        category: 'CONCERTS',
        maxResaleMultiplierBps: 12_000,
        royaltyBps: 500,
        organization: { stellarAccount: 'GORG' },
      });
      prisma.event.update.mockResolvedValue({});

      const { unsignedXdr } = await service.buildPublishTx(
        'organizer-1',
        'event-1',
      );

      expect(unsignedXdr).toBe('unsigned-xdr');
      expect(organizations.assertMember).toHaveBeenCalledWith(
        'org-1',
        'organizer-1',
      );
      expect(stellar.buildCreateEventTx).toHaveBeenCalledWith(
        expect.objectContaining({
          organizerPublicKey: 'GORG',
          name: 'Radiohead Live',
          category: 'CONCERTS',
          maxResaleMultiplierBps: 12_000,
          royaltyBps: 500,
        }),
      );
    });
  });

  describe('confirmPublish', () => {
    it('requires publish to have been called first', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        chainEventId: null,
        organization: { stellarAccount: 'GORG' },
      });

      await expect(
        service.confirmPublish('organizer-1', 'event-1', 'signed-xdr'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a confirmed transaction whose on-chain event does not match', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        chainEventId: 99n,
        organization: { stellarAccount: 'GORG' },
      });
      stellar.getEvent.mockResolvedValue({
        eventId: 100n,
        organizer: 'GOTHER',
      });

      await expect(
        service.confirmPublish('organizer-1', 'event-1', 'signed-xdr'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('submits the signed transaction and marks the event published', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        chainEventId: 99n,
        organization: { stellarAccount: 'GORG' },
      });
      prisma.event.update.mockResolvedValue({
        id: 'event-1',
        status: 'PUBLISHED',
      });

      const event = await service.confirmPublish(
        'organizer-1',
        'event-1',
        'signed-xdr',
      );

      expect(stellar.submitSignedTransaction).toHaveBeenCalledWith(
        'signed-xdr',
      );
      expect(stellar.getEvent).toHaveBeenCalledWith(99n);
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { status: 'PUBLISHED', publishedTxHash: '0xabc' },
      });
      expect(event.status).toBe('PUBLISHED');
    });
  });

  describe('unpublish', () => {
    it('reverts a published event to draft when no tickets exist', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        status: 'PUBLISHED',
        organization: { stellarAccount: 'GORG' },
      });
      prisma.ticket.count.mockResolvedValue(0);
      prisma.event.update.mockResolvedValue({ id: 'event-1', status: 'DRAFT' });

      const event = await service.unpublish('organizer-1', 'event-1');

      expect(prisma.ticket.count).toHaveBeenCalledWith({
        where: { eventId: 'event-1' },
      });
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { status: 'DRAFT' },
      });
      expect(event.status).toBe('DRAFT');
    });

    it('returns conflict when tickets have already been issued', async () => {
      prisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        organizationId: 'org-1',
        status: 'PUBLISHED',
        organization: { stellarAccount: 'GORG' },
      });
      prisma.ticket.count.mockResolvedValue(1);

      await expect(
        service.unpublish('organizer-1', 'event-1'),
      ).rejects.toMatchObject({ status: 409 });
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  describe('findForOrganization', () => {
    it('requires membership before listing an organization’s events', async () => {
      organizations.assertMember.mockRejectedValue(new Error('not a member'));

      await expect(
        service.findForOrganization('outsider-1', 'org-1'),
      ).rejects.toThrow('not a member');
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });

    it('returns the organization’s events, drafts included, as a page', async () => {
      prisma.event.findMany.mockResolvedValue([
        { id: 'event-1', status: 'DRAFT' },
      ]);
      prisma.event.count.mockResolvedValue(1);

      const page = await service.findForOrganization('organizer-1', 'org-1');

      expect(organizations.assertMember).toHaveBeenCalledWith(
        'org-1',
        'organizer-1',
      );
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
          skip: 0,
          take: 20,
        }),
      );
      expect(page).toEqual({
        items: [{ id: 'event-1', status: 'DRAFT' }],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('narrows the listing to a single status when one is given', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findForOrganization('organizer-1', 'org-1', {
        status: 'PUBLISHED',
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1', status: 'PUBLISHED' },
        }),
      );
    });

    it('skips the preceding pages and caps the page at the requested limit', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      const page = await service.findForOrganization('organizer-1', 'org-1', {
        page: 3,
        limit: 10,
      });

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(page).toMatchObject({ page: 3, limit: 10 });
    });

    it('reports the total across all pages, counted with the same filter', async () => {
      prisma.event.findMany.mockResolvedValue([{ id: 'event-1' }]);
      prisma.event.count.mockResolvedValue(45);

      const page = await service.findForOrganization('organizer-1', 'org-1', {
        status: 'DRAFT',
        limit: 1,
      });

      expect(prisma.event.count).toHaveBeenCalledWith({
        where: { organizationId: 'org-1', status: 'DRAFT' },
      });
      expect(page.total).toBe(45);
      expect(page.items).toHaveLength(1);
    });

    it('orders by createdAt then id so pages stay stable when timestamps tie', async () => {
      prisma.event.findMany.mockResolvedValue([]);

      await service.findForOrganization('organizer-1', 'org-1');

      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
      );
    });
  });
});
