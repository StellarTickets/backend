import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { StellarService } from '../stellar/stellar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly stellar: StellarService,
  ) {}

  async create(userId: string, organizationId: string, dto: CreateEventDto) {
    await this.organizations.assertMember(organizationId, userId);
    if (dto.endsAt && dto.endsAt <= dto.startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    return this.prisma.event.create({
      data: {
        organizationId,
        name: dto.name,
        category: dto.category,
        venue: dto.venue,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt,
        maxResaleMultiplierBps: dto.maxResaleMultiplierBps ?? 11_000,
        royaltyBps: dto.royaltyBps ?? 500,
      },
    });
  }

  async addTicketType(
    userId: string,
    eventId: string,
    dto: CreateTicketTypeDto,
  ) {
    const event = await this.getWithOrg(eventId);
    await this.organizations.assertMember(event.organizationId, userId);
    return this.prisma.ticketType.create({
      data: {
        eventId,
        name: dto.name,
        price: BigInt(dto.price),
        quantityTotal: dto.quantityTotal,
      },
    });
  }

  /** Step 1 of publishing: returns an unsigned XDR for the organizer's wallet to sign. */
  async buildPublishTx(
    userId: string,
    eventId: string,
  ): Promise<{ unsignedXdr: string }> {
    const event = await this.getWithOrg(eventId);
    await this.organizations.assertMember(event.organizationId, userId);
    if (event.status !== EventStatus.DRAFT) {
      throw new BadRequestException('Only draft events can be published');
    }
    if (event.chainEventId !== null) {
      throw new BadRequestException(
        'This event already has a pending or confirmed on-chain id',
      );
    }

    const chainEventId = await this.reserveChainEventId(eventId);
    const unsignedXdr = await this.stellar.buildCreateEventTx({
      organizerPublicKey: event.organization.stellarAccount,
      chainEventId,
      name: event.name,
      category: event.category,
      maxResaleMultiplierBps: event.maxResaleMultiplierBps,
      royaltyBps: event.royaltyBps,
    });
    return { unsignedXdr };
  }

  /** Step 2: relays the organizer-signed XDR and marks the event published once it lands. */
  async confirmPublish(userId: string, eventId: string, signedXdr: string) {
    const event = await this.getWithOrg(eventId);
    await this.organizations.assertMember(event.organizationId, userId);
    if (event.chainEventId === null) {
      throw new BadRequestException('Call publish before confirm-publish');
    }

    await this.stellar.submitSignedTransaction(signedXdr);
    return this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PUBLISHED },
    });
  }

  async getWithOrg(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { organization: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  findPublished() {
    return this.prisma.event.findMany({
      where: { status: EventStatus.PUBLISHED },
      include: {
        ticketTypes: true,
        organization: { select: { name: true, slug: true } },
      },
      orderBy: { startsAt: 'asc' },
    });
  }

  async findForOrganization(userId: string, organizationId: string) {
    await this.organizations.assertMember(organizationId, userId);
    return this.prisma.event.findMany({
      where: { organizationId },
      include: { ticketTypes: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Picks a random u64 (well within Postgres's signed-bigint range) and reserves it on the event row. */
  private async reserveChainEventId(eventId: string): Promise<bigint> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomBytes(6).readUIntBE(0, 6); // 48 bits — Buffer#readUIntBE caps at 6 bytes
      try {
        await this.prisma.event.update({
          where: { id: eventId },
          data: { chainEventId: BigInt(candidate) },
        });
        return BigInt(candidate);
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue; // collision on the unique chainEventId column, retry
        }
        throw err;
      }
    }
    throw new BadRequestException(
      'Could not allocate an on-chain event id, please retry',
    );
  }
}
