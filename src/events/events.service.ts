import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { StellarService } from '../stellar/stellar.service';
import { AuditService } from '../audit/audit.service';
import {
  DEFAULT_PAGE_LIMIT,
  PaginationQueryDto,
} from '../common/dto/pagination-query.dto';
import { toSkipTake } from '../common/pagination/paginated';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateTicketTypeDto } from './dto/create-ticket-type.dto';
import { CACHE_STORE } from '../common/cache/cache-store';
import { Inject } from '@nestjs/common';
import { formatPrice } from '../common/utils/currency';
import { getSettlementAsset } from '../config/settlement-asset';
import type { SettlementAsset } from '../config/settlement-asset';

/** On-chain existence derived from `StellarService.getEvent`, reported alongside the cached DB `status` when reconciliation is requested. */
export type OnChainReconciliationStatus =
  'PUBLISHED' | 'NOT_FOUND' | 'NOT_PUBLISHED';

function hasPricedTicketTypes<T extends object>(
  event: T,
): event is T & { ticketTypes: Array<{ price: bigint }> } {
  return (
    'ticketTypes' in event &&
    Array.isArray(event.ticketTypes) &&
    event.ticketTypes.every(
      (ticketType: unknown) =>
        typeof ticketType === 'object' &&
        ticketType !== null &&
        'price' in ticketType &&
        typeof ticketType.price === 'bigint',
    )
  );
}

@Injectable()
export class EventsService {
  private readonly settlementAsset: SettlementAsset;

  constructor(
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
    private readonly stellar: StellarService,
    config: ConfigService,
    @Optional() private readonly audit?: AuditService,
    @Optional()
    @Inject(CACHE_STORE)
    private readonly cache?: { delete(k: string): Promise<void> },
  ) {
    this.settlementAsset = getSettlementAsset(config);
  }

  async create(userId: string, organizationId: string, dto: CreateEventDto) {
    await this.organizations.assertMember(organizationId, userId);
    const org = await this.organizations.findOne(organizationId);

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          organizationId,
          name: dto.name,
          category: dto.category,
          venue: dto.venue,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          maxResaleMultiplierBps:
            dto.maxResaleMultiplierBps ?? org.defaultMaxResaleMultiplierBps,
          royaltyBps: dto.royaltyBps ?? org.defaultRoyaltyBps,
        },
      });

      if (dto.ticketTypes?.length) {
        await tx.ticketType.createMany({
          data: dto.ticketTypes.map((ticketType) => ({
            eventId: created.id,
            name: ticketType.name,
            price: BigInt(ticketType.price),
            quantityTotal: ticketType.quantityTotal,
          })),
        });
      }

      return tx.event.findUniqueOrThrow({
        where: { id: created.id },
        include: { ticketTypes: true },
      });
    });
    // #209 — audit event creation.
    await this.audit?.record(userId, 'event.create', 'Event', event.id, {
      organizationId,
    });
    await this.invalidateCache();
    return this.withEventPricing(event);
  }

  async addTicketType(
    userId: string,
    eventId: string,
    dto: CreateTicketTypeDto,
  ) {
    const event = await this.getWithOrg(eventId);
    await this.organizations.assertMember(event.organizationId, userId);
    if (
      dto.saleStartsAt &&
      dto.saleEndsAt &&
      dto.saleEndsAt <= dto.saleStartsAt
    ) {
      throw new BadRequestException('Ticket sale end must be after its start');
    }
    const ticketType = await this.prisma.ticketType.create({
      data: {
        eventId,
        name: dto.name,
        price: BigInt(dto.price),
        quantityTotal: dto.quantityTotal,
        saleStartsAt: dto.saleStartsAt,
        saleEndsAt: dto.saleEndsAt,
        isHidden: dto.isHidden ?? false,
      },
    });
    return this.withTicketTypePricing(ticketType);
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
    // #381 — an expired, unconfirmed reservation no longer blocks publishing.
    if (event.publishedTxHash !== null || this.hasPendingReservation(event)) {
      throw new BadRequestException(
        'This event already has a pending or confirmed on-chain id',
      );
    }
    // Checked before reserving a chain id so a rejected publish burns nothing.
    const ticketTypeCount = await this.prisma.ticketType.count({
      where: { eventId },
    });
    if (ticketTypeCount === 0) {
      throw new ConflictException(
        'Add at least one ticket type before publishing this event',
      );
    }

    const chainEventId = await this.reserveChainEventId(event);
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
    // #382 — refuse before any network call, so a published event can't
    // relay a second `create_event` or have its status rewritten.
    if (event.status !== EventStatus.DRAFT) {
      throw new ConflictException('Only draft events can be published');
    }
    if (event.chainEventId === null) {
      throw new BadRequestException('Call publish before confirm-publish');
    }

    const { txHash } = await this.stellar.submitSignedTransaction(signedXdr);

    let onChainEvent: Awaited<ReturnType<StellarService['getEvent']>>;
    try {
      onChainEvent = await this.stellar.getEvent(event.chainEventId);
    } catch {
      throw new BadRequestException(
        'Submission succeeded but the on-chain event could not be confirmed',
      );
    }
    if (
      onChainEvent.eventId !== event.chainEventId ||
      onChainEvent.organizer !== event.organization.stellarAccount
    ) {
      throw new BadRequestException(
        'Published on-chain event does not match the reserved event id and organizer',
      );
    }

    const published = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.PUBLISHED, publishedTxHash: txHash },
    });
    // #209 — audit event publish.
    await this.audit?.record(userId, 'event.publish', 'Event', eventId, {
      txHash,
    });
    await this.invalidateCache();
    return published;
  }

  async unpublish(userId: string, eventId: string) {
    const event = await this.getWithOrg(eventId);
    await this.organizations.assertMember(event.organizationId, userId);
    if (event.status !== EventStatus.PUBLISHED) {
      throw new BadRequestException('Only published events can be unpublished');
    }
    const ticketCount = await this.prisma.ticket.count({ where: { eventId } });
    if (ticketCount > 0) {
      throw new ConflictException(
        'Cannot unpublish an event with issued tickets',
      );
    }
    const unpublished = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: EventStatus.DRAFT },
    });
    await this.audit?.record(userId, 'event.unpublish', 'Event', eventId);
    await this.invalidateCache();
    return unpublished;
  }

  async getWithOrg(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { organization: true },
    });
    // #207 — soft-deleted events read as not-found.
    if (!event || (event as { deletedAt?: Date | null }).deletedAt) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }

  /** Looks up the event, optionally reconciling its cached DB `status` against the chain. */
  async getWithReconciliation(eventId: string, reconcile: boolean) {
    const event = await this.getWithOrg(eventId);
    if (!reconcile) {
      return this.withEventPricing(event);
    }
    return this.withEventPricing({
      ...event,
      onChainStatus: await this.getOnChainStatus(event),
    });
  }

  private async getOnChainStatus(event: {
    chainEventId: bigint | null;
  }): Promise<OnChainReconciliationStatus> {
    if (event.chainEventId === null) {
      return 'NOT_PUBLISHED';
    }
    try {
      await this.stellar.getEvent(event.chainEventId);
      return 'PUBLISHED';
    } catch {
      return 'NOT_FOUND';
    }
  }

  /** One page of published events plus the total count, for `GET /events`. */
  async findPublished(query: PaginationQueryDto) {
    // #207 — exclude soft-deleted events and events of soft-deleted orgs.
    const where = {
      status: EventStatus.PUBLISHED,
      deletedAt: null,
      organization: { deletedAt: null },
    };
    const [events, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: {
          ticketTypes: { where: { isHidden: false } },
          organization: { select: { name: true, slug: true } },
        },
        // `id` breaks ties between events starting at the same time so
        // rows can't shift between pages.
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        ...toSkipTake(query),
      }),
      this.prisma.event.count({ where }),
    ]);
    return [
      events.map((event) => this.withEventPricing(event)),
      total,
    ] as const;
  }

  /** #207 — soft-delete: sets `deletedAt` instead of hard-deleting. */
  async softDelete(userId: string, eventId: string) {
    const event = await this.getWithOrg(eventId);
    await this.organizations.assertMember(event.organizationId, userId);
    const deleted = await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });
    await this.audit?.record(userId, 'event.delete', 'Event', eventId);
    await this.invalidateCache();
    return deleted;
  }

  /** #207 — restore a soft-deleted event. */
  async restore(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { organization: true },
    });
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    await this.organizations.assertMember(event.organizationId, userId);
    const restored = await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: null },
    });
    await this.audit?.record(userId, 'event.restore', 'Event', eventId);
    await this.invalidateCache();
    return restored;
  }

  async findForOrganization(
    userId: string,
    organizationId: string,
    {
      status,
      page = 1,
      limit = DEFAULT_PAGE_LIMIT,
    }: { status?: EventStatus; page?: number; limit?: number } = {},
  ) {
    await this.organizations.assertMember(organizationId, userId);
    // #207 — soft-deleted events are excluded from org listings.
    const where = {
      organizationId,
      deletedAt: null,
      ...(status && { status }),
    };

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: { ticketTypes: true },
        // id breaks createdAt ties so a row can't repeat or vanish across pages.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      items: items.map((event) => this.withEventPricing(event)),
      total,
      page,
      limit,
    };
  }

  private withEventPricing<T extends object>(event: T) {
    if ('ticketTypes' in event) {
      if (!hasPricedTicketTypes(event)) {
        throw new TypeError('Event ticket types must include bigint prices');
      }
      return {
        ...event,
        settlementAsset: this.settlementAsset,
        ticketTypes: event.ticketTypes.map((ticketType) =>
          this.withTicketTypePricing(ticketType),
        ),
      };
    }

    return {
      ...event,
      settlementAsset: this.settlementAsset,
    };
  }

  private withTicketTypePricing<T extends { price: bigint }>(ticketType: T) {
    return {
      ...ticketType,
      priceDisplay: `${formatPrice(ticketType.price, this.settlementAsset.decimals)} ${this.settlementAsset.code}`,
    };
  }

  /** Event counts per status for one organization, for `GET .../events/summary`. */
  async summarizeForOrganization(userId: string, organizationId: string) {
    await this.organizations.assertMember(organizationId, userId);
    // #207 — soft-deleted events are excluded from the summary too.
    const groups = await this.prisma.event.groupBy({
      by: ['status'],
      where: { organizationId, deletedAt: null },
      _count: { _all: true },
    });

    // Every status is present, even at zero, so the response shape is stable.
    const byStatus = Object.fromEntries(
      Object.values(EventStatus).map((status) => [status, 0]),
    ) as Record<EventStatus, number>;
    for (const group of groups) {
      byStatus[group.status] = group._count._all;
    }
    const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return { total, byStatus };
  }

  /**
   * #381 — a reservation is pending while the envelope built for it is
   * inside its time bound (`StellarService.buildTxTimeoutSeconds`). After
   * that the network rejects the envelope (`txTOO_LATE`), so it can never
   * land and the reservation is free to take over.
   */
  private hasPendingReservation(event: {
    chainEventId: bigint | null;
    chainEventIdReservedAt: Date | null;
  }): boolean {
    if (event.chainEventId === null || event.chainEventIdReservedAt === null) {
      return false;
    }
    const expiresAt =
      event.chainEventIdReservedAt.getTime() +
      this.stellar.buildTxTimeoutSeconds * 1000;
    return Date.now() < expiresAt;
  }

  /**
   * Reserves the event's on-chain id and stamps the reservation time. An
   * abandoned reservation (#381) is reused rather than replaced: the
   * contract rejects a second `create_event` for one id
   * (`EventAlreadyExists`), so reuse can never register the event twice.
   * Otherwise picks a random u64 (well within Postgres's signed-bigint range).
   */
  private async reserveChainEventId(event: {
    id: string;
    chainEventId: bigint | null;
  }): Promise<bigint> {
    const chainEventIdReservedAt = new Date();
    if (event.chainEventId !== null) {
      await this.prisma.event.update({
        where: { id: event.id },
        data: { chainEventIdReservedAt },
      });
      return event.chainEventId;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = randomBytes(6).readUIntBE(0, 6); // 48 bits — Buffer#readUIntBE caps at 6 bytes
      try {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { chainEventId: BigInt(candidate), chainEventIdReservedAt },
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

  private async invalidateCache(): Promise<void> {
    if (!this.cache) return;
    try {
      await this.cache.delete('cache:/v1/events');
    } catch {
      // Cache invalidation failure is non-critical
    }
  }
}
