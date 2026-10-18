import {
  ConflictException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { InvitationsService, INVITATION_TTL_MS } from './invitations.service';
import type { OrganizationsService } from './organizations.service';
import type { PrismaService } from '../prisma/prisma.service';
import { createOrganization } from '../../test/factories';

const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

describe('InvitationsService', () => {
  let service: InvitationsService;
  let organizations: { findOne: jest.Mock; assertRole: jest.Mock };
  let prisma: {
    organizationInvitation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
    organizationMember: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    user: { findUnique: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    organizations = {
      findOne: jest.fn().mockResolvedValue(createOrganization({ id: 'org-1' })),
      assertRole: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      organizationInvitation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      organizationMember: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'user-2', email: 'new@example.com' }),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    service = new InvitationsService(
      prisma as unknown as PrismaService,
      organizations as unknown as OrganizationsService,
    );
  });

  describe('create', () => {
    it('requires OWNER/ADMIN and stores only the token hash with a 7-day expiry', async () => {
      prisma.organizationInvitation.create.mockImplementation(
        ({ data }: { data: Record<string, unknown> }) => ({
          id: 'inv-1',
          ...data,
        }),
      );
      const before = Date.now();

      const { invitation, token } = await service.create('user-1', 'org-1', {
        email: 'new@example.com',
      });

      expect(organizations.assertRole).toHaveBeenCalledWith('org-1', 'user-1', [
        'OWNER',
        'ADMIN',
      ]);
      expect(token).toMatch(/^inv_[0-9a-f]{64}$/);
      const [[{ data }]] = prisma.organizationInvitation.create.mock.calls as [
        [{ data: Record<string, unknown> }],
      ];
      expect(data).toMatchObject({
        organizationId: 'org-1',
        email: 'new@example.com',
        role: 'STAFF',
        tokenHash: hash(token),
        invitedById: 'user-1',
      });
      const expiresAt = (data.expiresAt as Date).getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(before + INVITATION_TTL_MS);
      expect(expiresAt).toBeLessThanOrEqual(Date.now() + INVITATION_TTL_MS);
      expect(invitation).toMatchObject({ id: 'inv-1' });
    });

    it('propagates a role rejection without creating an invite', async () => {
      organizations.assertRole.mockRejectedValue(new ForbiddenException());
      await expect(
        service.create('user-1', 'org-1', { email: 'new@example.com' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.organizationInvitation.create).not.toHaveBeenCalled();
    });

    it('rejects inviting an existing member', async () => {
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm-1' });
      await expect(
        service.create('user-1', 'org-1', { email: 'new@example.com' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.organizationInvitation.create).not.toHaveBeenCalled();
    });
  });

  describe('accept', () => {
    const pending = (overrides: Record<string, unknown> = {}) => ({
      id: 'inv-1',
      organizationId: 'org-1',
      email: 'new@example.com',
      role: 'ADMIN',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      organization: createOrganization({ id: 'org-1' }),
      ...overrides,
    });

    it('creates the OrganizationMember with the invited role and promotes an ATTENDEE', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(pending());
      prisma.organizationMember.create.mockResolvedValue({
        id: 'm-1',
        organizationId: 'org-1',
        userId: 'user-2',
        role: 'ADMIN',
      });

      const member = await service.accept('user-2', 'inv_abc');

      expect(prisma.organizationInvitation.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: hash('inv_abc') },
        include: { organization: true },
      });
      expect(prisma.organizationInvitation.updateMany).toHaveBeenCalledWith({
        where: { id: 'inv-1', acceptedAt: null },
        data: { acceptedAt: expect.any(Date) as Date, acceptedById: 'user-2' },
      });
      expect(prisma.organizationMember.create).toHaveBeenCalledWith({
        data: { organizationId: 'org-1', userId: 'user-2', role: 'ADMIN' },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: 'user-2', role: 'ATTENDEE' },
        data: { role: 'ORGANIZER' },
      });
      expect(member).toMatchObject({ id: 'm-1', role: 'ADMIN' });
    });

    it('returns 410 Gone for an expired invite', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(
        pending({ expiresAt: new Date(Date.now() - 1) }),
      );
      await expect(service.accept('user-2', 'inv_abc')).rejects.toBeInstanceOf(
        GoneException,
      );
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });

    it('404s for an unknown token or a soft-deleted organization', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValueOnce(null);
      await expect(service.accept('user-2', 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );

      prisma.organizationInvitation.findUnique.mockResolvedValueOnce(
        pending({
          organization: createOrganization({ deletedAt: new Date() }),
        }),
      );
      await expect(service.accept('user-2', 'inv_abc')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('409s for an already-accepted invite', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(
        pending({ acceptedAt: new Date() }),
      );
      await expect(service.accept('user-2', 'inv_abc')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('409s when a concurrent accept claimed the invite first', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(pending());
      prisma.organizationInvitation.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.accept('user-2', 'inv_abc')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });

    it('409s when the user is already a member', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(pending());
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1' });
      await expect(service.accept('user-2', 'inv_abc')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });

    it('403s when the signed-in user is not the invited email', async () => {
      prisma.organizationInvitation.findUnique.mockResolvedValue(pending());
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-3',
        email: 'other@example.com',
      });
      await expect(service.accept('user-3', 'inv_abc')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.organizationMember.create).not.toHaveBeenCalled();
    });
  });
});
