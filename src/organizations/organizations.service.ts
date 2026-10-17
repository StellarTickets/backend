import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OrgMemberRole, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const existingSlug = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException('That organization slug is already taken');
    }

    const org = await this.prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          industry: dto.industry,
          stellarAccount: dto.stellarAccount,
          logoUrl: dto.logoUrl,
          websiteUrl: dto.websiteUrl,
          defaultMaxResaleMultiplierBps: dto.defaultMaxResaleMultiplierBps,
          defaultRoyaltyBps: dto.defaultRoyaltyBps,
        },
      });
      await tx.organizationMember.create({
        data: { organizationId: created.id, userId, role: OrgMemberRole.OWNER },
      });
      await tx.user.updateMany({
        where: { id: userId, role: UserRole.ATTENDEE },
        data: { role: UserRole.ORGANIZER },
      });
      return created;
    });

    // #209 — audit org creation (best-effort, never blocks the response).
    await this.audit?.record(
      userId,
      'organization.create',
      'Organization',
      org.id,
      {
        slug: org.slug,
      },
    );
    return org;
  }

  async findMine(userId: string) {
    return this.prisma.organization.findMany({
      // #207 — hide soft-deleted orgs.
      where: { members: { some: { userId } }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    // #207 — soft-deleted rows read as not-found.
    if (!org || (org as { deletedAt?: Date | null }).deletedAt) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  /** #207 — soft-delete: sets `deletedAt` instead of hard-deleting. */
  async softDelete(userId: string, id: string) {
    await this.findOne(id);
    await this.assertMember(id, userId);
    const org = await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.organization.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      // #390 — an ORGANIZER is a member of at least one live organization.
      // Demote this org's members that no longer are, in one statement.
      await tx.user.updateMany({
        where: {
          role: UserRole.ORGANIZER,
          memberships: {
            some: { organizationId: id },
            none: { organization: { deletedAt: null } },
          },
        },
        data: { role: UserRole.ATTENDEE },
      });
      return deleted;
    });
    await this.audit?.record(userId, 'organization.delete', 'Organization', id);
    return org;
  }

  /** #207 — restore a soft-deleted organization. */
  async restore(userId: string, id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    await this.assertMember(id, userId);
    const restored = await this.prisma.$transaction(async (tx) => {
      const live = await tx.organization.update({
        where: { id },
        data: { deletedAt: null },
      });
      // #390 — members regain ORGANIZER once the organization is live again.
      await tx.user.updateMany({
        where: {
          role: UserRole.ATTENDEE,
          memberships: { some: { organizationId: id } },
        },
        data: { role: UserRole.ORGANIZER },
      });
      return live;
    });
    await this.audit?.record(
      userId,
      'organization.restore',
      'Organization',
      id,
    );
    return restored;
  }

  /** Throws unless `userId` is a member of `organizationId`. Used by Events/Tickets services to authorize writes. */
  async assertMember(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!membership) {
      throw new ForbiddenException('You are not a member of this organization');
    }
  }
}
