import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: {
    organization: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
    };
    organizationMember: { create: jest.Mock; findUnique: jest.Mock };
    user: { updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      organization: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      organizationMember: { create: jest.fn(), findUnique: jest.fn() },
      user: { updateMany: jest.fn() },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new OrganizationsService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('rejects a slug that is already taken', async () => {
      prisma.organization.findUnique.mockResolvedValue({ id: 'existing-org' });

      await expect(
        service.create('user-1', {
          name: 'Test Org',
          slug: 'test-org',
          industry: 'CONCERTS',
          stellarAccount: 'G'.repeat(56),
        } as never),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.organization.create).not.toHaveBeenCalled();
    });

    it('creates the org, an OWNER membership, and promotes an ATTENDEE to ORGANIZER', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);
      prisma.organization.create.mockResolvedValue({
        id: 'org-1',
        slug: 'test-org',
      });

      const org = await service.create('user-1', {
        name: 'Test Org',
        slug: 'test-org',
        industry: 'CONCERTS',
        stellarAccount: 'G'.repeat(56),
      } as never);

      expect(prisma.organizationMember.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-1', userId: 'user-1', role: 'OWNER' },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-1', role: 'ATTENDEE' },
        data: { role: 'ORGANIZER' },
      });
      expect(org).toEqual({ id: 'org-1', slug: 'test-org' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException for a missing organization', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertMember', () => {
    it('throws ForbiddenException when the user is not a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(
        service.assertMember('org-1', 'user-1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('resolves silently when the user is a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: 'membership-1',
      });

      await expect(
        service.assertMember('org-1', 'user-1'),
      ).resolves.toBeUndefined();
    });
  });
});
