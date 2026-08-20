import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgMemberRole, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const existingSlug = await this.prisma.organization.findUnique({
      where: { slug: dto.slug },
    });
    if (existingSlug) {
      throw new ConflictException('That organization slug is already taken');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: dto });
        await tx.organizationMember.create({
          data: { organizationId: org.id, userId, role: OrgMemberRole.OWNER },
        });
        await tx.user.updateMany({
          where: { id: userId, role: UserRole.ATTENDEE },
          data: { role: UserRole.ORGANIZER },
        });
        return org;
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('That organization slug is already taken');
      }
      throw err;
    }
  }

  async findMine(userId: string) {
    return this.prisma.organization.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const org = await this.prisma.organization.findUnique({ where: { id } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
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
