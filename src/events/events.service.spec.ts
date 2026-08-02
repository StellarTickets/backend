import { BadRequestException } from '@nestjs/common';

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
    };
  };
  let organizations: { assertMember: jest.Mock };
  let stellar: {
    buildCreateEventTx: jest.Mock;
    submitSignedTransaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      event: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };
    organizations = { assertMember: jest.fn().mockResolvedValue(undefined) };
    stellar = {
      buildCreateEventTx: jest.fn().mockResolvedValue('unsigned-xdr'),
      submitSignedTransaction: jest
        .fn()
        .mockResolvedValue({ result: null, txHash: '0xabc' }),
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
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { status: 'PUBLISHED' },
      });
      expect(event.status).toBe('PUBLISHED');
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

    it('returns every event for the organization, drafts included', async () => {
      prisma.event.findMany.mockResolvedValue([
        { id: 'event-1', status: 'DRAFT' },
      ]);

      const events = await service.findForOrganization('organizer-1', 'org-1');

      expect(organizations.assertMember).toHaveBeenCalledWith(
        'org-1',
        'organizer-1',
      );
      expect(prisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { organizationId: 'org-1' } }),
      );
      expect(events).toEqual([{ id: 'event-1', status: 'DRAFT' }]);
    });
  });
});
