import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OrgMemberRole, UserRole } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { OrganizationsService } from './organizations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

const TOKEN_PREFIX = 'inv';
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  /** Invites `dto.email` to the organization (OWNER/ADMIN only) and returns the raw token once -- only its hash is persisted. */
  async create(
    userId: string,
    organizationId: string,
    dto: CreateInvitationDto,
  ) {
    await this.organizations.findOne(organizationId);
    await this.organizations.assertRole(organizationId, userId, [
      OrgMemberRole.OWNER,
      OrgMemberRole.ADMIN,
    ]);

    const existingMember = await this.prisma.organizationMember.findFirst({
      where: { organizationId, user: { email: dto.email } },
    });
    if (existingMember) {
      throw new ConflictException(
        'That user is already a member of this organization',
      );
    }

    const token = `${TOKEN_PREFIX}_${randomBytes(32).toString('hex')}`;
    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: dto.email,
        role: dto.role ?? OrgMemberRole.STAFF,
        tokenHash: this.hash(token),
        invitedById: userId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      },
      omit: { tokenHash: true },
    });
    await this.audit?.record(
      userId,
      'organization.invite',
      'Organization',
      organizationId,
      { invitationId: invitation.id, role: invitation.role },
    );
    return { invitation, token };
  }

  /**
   * Accepts an invite on behalf of the signed-in user, whose email must match
   * the invite's. Creates the `OrganizationMember` and promotes an ATTENDEE to
   * ORGANIZER. `410` once the invite has expired.
   */
  async accept(userId: string, token: string) {
    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { tokenHash: this.hash(token) },
      include: { organization: true },
    });
    // #207 — invites to a soft-deleted organization read as not-found.
    if (!invitation || invitation.organization.deletedAt) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.acceptedAt) {
      throw new ConflictException('Invitation has already been accepted');
    }
    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new GoneException('Invitation has expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.email !== invitation.email) {
      throw new ForbiddenException(
        'This invitation was sent to a different email address',
      );
    }

    const { organizationId } = invitation;
    const member = await this.prisma.$transaction(async (tx) => {
      // Conditional on `acceptedAt: null` so two concurrent accepts can't both win.
      const claimed = await tx.organizationInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null },
        data: { acceptedAt: new Date(), acceptedById: userId },
      });
      if (claimed.count === 0) {
        throw new ConflictException('Invitation has already been accepted');
      }
      const existing = await tx.organizationMember.findUnique({
        where: { organizationId_userId: { organizationId, userId } },
      });
      if (existing) {
        throw new ConflictException(
          'You are already a member of this organization',
        );
      }
      const created = await tx.organizationMember.create({
        data: { organizationId, userId, role: invitation.role },
      });
      // #390 — members of a live organization are ORGANIZERs.
      await tx.user.updateMany({
        where: { id: userId, role: UserRole.ATTENDEE },
        data: { role: UserRole.ORGANIZER },
      });
      return created;
    });

    await this.audit?.record(
      userId,
      'organization.invite.accept',
      'Organization',
      organizationId,
      { invitationId: invitation.id, role: member.role },
    );
    return member;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
