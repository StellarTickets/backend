import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import type { CurrentUserPayload } from '../src/auth/decorators/current-user.decorator';
import type { Ticket, User } from '@prisma/client';
import {
  createEvent,
  createOrganization,
  createTicket,
  createTicketType,
  createUser,
} from './factories';

// Requires a real DATABASE_URL — same constraint as app.e2e-spec.ts. Covers
// the resale marketplace: list -> cancel, and list -> buy, asserting the
// ticket and resale listing status transitions between each step (#223).
describe('Resale flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let currentUser: CurrentUserPayload;

  const mockStellarService = {
    buildListForResaleTx: jest.fn().mockResolvedValue('unsigned-list-xdr'),
    buildCancelResaleTx: jest.fn().mockResolvedValue('unsigned-cancel-xdr'),
    buildBuyResaleTx: jest.fn().mockResolvedValue('unsigned-buy-xdr'),
    submitSignedTransaction: jest
      .fn()
      .mockResolvedValue({ txHash: 'b'.repeat(64) }),
    decodeSignedInvocation: jest.fn(),
    verifyTicket: jest.fn().mockResolvedValue({ resalePrice: 1100n }),
  };

  /** #376 — the signed envelope lists `ticket` at the body's 1100 price. */
  function signListing(seller: User, ticket: Ticket) {
    mockStellarService.decodeSignedInvocation.mockReturnValue({
      functionName: 'list_for_resale',
      args: [seller.stellarPublicKey, ticket.chainTicketId, 1100n],
    });
  }

  async function seedTicket(
    overrides: {
      price?: bigint;
      maxResaleMultiplierBps?: number;
    } = {},
  ) {
    const seller = await prisma.user.create({
      data: createUser({
        id: randomUUID(),
        email: `seller-${randomUUID()}@example.com`,
        stellarPublicKey: `G${randomUUID().replace(/-/g, '').toUpperCase().padEnd(55, 'A')}`,
      }),
    });
    const organization = await prisma.organization.create({
      data: createOrganization({
        id: randomUUID(),
        slug: `org-${randomUUID()}`,
      }),
    });
    const event = await prisma.event.create({
      data: createEvent({
        id: randomUUID(),
        organizationId: organization.id,
        status: 'PUBLISHED',
        maxResaleMultiplierBps: overrides.maxResaleMultiplierBps ?? 15_000,
      }),
    });
    const ticketType = await prisma.ticketType.create({
      data: createTicketType({
        id: randomUUID(),
        eventId: event.id,
        price: overrides.price ?? 1_000n,
      }),
    });
    const ticket = await prisma.ticket.create({
      data: createTicket({
        id: randomUUID(),
        eventId: event.id,
        ticketTypeId: ticketType.id,
        ownerId: seller.id,
        chainTicketId: BigInt(Math.floor(Math.random() * 1_000_000) + 1),
        status: 'VALID',
      }),
    });
    return { seller, organization, event, ticketType, ticket };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context
            .switchToHttp()
            .getRequest<{ user?: CurrentUserPayload }>();
          req.user = currentUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists a ticket for resale then cancels the listing', async () => {
    const { seller, ticket } = await seedTicket();
    signListing(seller, ticket);
    currentUser = { userId: seller.id, email: seller.email, role: seller.role };

    // Step 1: build the list-resale transaction.
    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/list-resale`)
      .send({ price: '1100' })
      .expect(201)
      .expect((res) => {
        expect((res.body as { unsignedXdr: string }).unsignedXdr).toBe(
          'unsigned-list-xdr',
        );
      });

    // Step 2: confirm the list-resale — ticket -> RESALE, listing -> ACTIVE.
    const confirmListRes = await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
      .send({ price: '1100', signedXdr: 'signed-xdr' })
      .expect(201);

    const listing = confirmListRes.body as { id: string; status: string };
    expect(listing.status).toBe('ACTIVE');
    const listingId = listing.id;

    const ticketAfterList = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(ticketAfterList.status).toBe('RESALE');

    // Sanity check: the listing shows up in the active resale feed.
    const listRes = await request(app.getHttpServer())
      .get('/v1/tickets/resale')
      .expect(200);
    const { items } = listRes.body as { items: { id: string }[] };
    expect(items.some((item) => item.id === listingId)).toBe(true);

    // Step 3: build + confirm cancel-resale — ticket -> VALID, listing -> CANCELLED.
    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/cancel-resale`)
      .expect(201)
      .expect((res) => {
        expect((res.body as { unsignedXdr: string }).unsignedXdr).toBe(
          'unsigned-cancel-xdr',
        );
      });

    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-cancel-resale`)
      .send({ signedXdr: 'signed-xdr' })
      .expect(201);

    const ticketAfterCancel = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(ticketAfterCancel.status).toBe('VALID');

    const listingAfterCancel = await prisma.resaleListing.findUniqueOrThrow({
      where: { id: listingId },
    });
    expect(listingAfterCancel.status).toBe('CANCELLED');
  });

  it('lists a ticket for resale then a different buyer purchases it', async () => {
    const { seller, ticket } = await seedTicket();
    const buyer = await prisma.user.create({
      data: createUser({
        id: randomUUID(),
        email: `buyer-${randomUUID()}@example.com`,
        stellarPublicKey: `G${randomUUID().replace(/-/g, '').toUpperCase().padEnd(55, 'A')}`,
      }),
    });

    // List as the seller.
    signListing(seller, ticket);
    currentUser = { userId: seller.id, email: seller.email, role: seller.role };
    const confirmListRes = await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
      .send({ price: '1100', signedXdr: 'signed-xdr' })
      .expect(201);
    const listing = confirmListRes.body as { id: string; status: string };
    const listingId = listing.id;
    expect(listing.status).toBe('ACTIVE');

    // Buy as the buyer.
    currentUser = { userId: buyer.id, email: buyer.email, role: buyer.role };
    await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/buy-resale`)
      .expect(201)
      .expect((res) => {
        expect((res.body as { unsignedXdr: string }).unsignedXdr).toBe(
          'unsigned-buy-xdr',
        );
      });

    const confirmBuyRes = await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-buy-resale`)
      .send({ signedXdr: 'signed-xdr' })
      .expect(201);

    const bought = confirmBuyRes.body as { ownerId: string; status: string };
    expect(bought.ownerId).toBe(buyer.id);
    expect(bought.status).toBe('VALID');

    const listingAfterBuy = await prisma.resaleListing.findUniqueOrThrow({
      where: { id: listingId },
    });
    expect(listingAfterBuy.status).toBe('SOLD');

    const ticketAfterBuy = await prisma.ticket.findUniqueOrThrow({
      where: { id: ticket.id },
    });
    expect(ticketAfterBuy.ownerId).toBe(buyer.id);
    expect(ticketAfterBuy.status).toBe('VALID');
  });

  it('does not expose qrSecret or ownerId in the resale marketplace feed (#374)', async () => {
    const { seller, ticket, event, ticketType } = await seedTicket();
    currentUser = { userId: seller.id, email: seller.email, role: seller.role };

    const listRes = await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
      .send({ price: '1100', signedXdr: 'signed-xdr' })
      .expect(201);
    const listingId = listRes.body.id as string;

    const feed = await request(app.getHttpServer())
      .get('/v1/tickets/resale')
      .expect(200);

    const item = (
      feed.body.items as Array<
        Record<string, unknown> & {
          id: string;
          ticket: Record<string, unknown> & {
            event: Record<string, unknown>;
            ticketType: Record<string, unknown>;
          };
          seller: Record<string, unknown>;
        }
      >
    ).find((listing) => listing.id === listingId);

    expect(item).toBeDefined();
    // The gate code and the current owner must never leave the server.
    expect(item).not.toHaveProperty('qrSecret');
    expect(item!.ticket).not.toHaveProperty('qrSecret');
    expect(item!.ticket).not.toHaveProperty('ownerId');

    // The fields the marketplace renders (and nothing sensitive) are present.
    expect(item!.ticket.event).toMatchObject({
      id: event.id,
      name: event.name,
      venue: event.venue,
    });
    expect(item!.ticket.event).toHaveProperty('startsAt');
    expect(item!.ticket.ticketType).toMatchObject({ name: ticketType.name });
    expect(item!.seller).toHaveProperty('name');
  });

  it('does not allow two ACTIVE resale listings for the same ticket (#216)', async () => {
    const { seller, ticket } = await seedTicket();
    signListing(seller, ticket);
    currentUser = { userId: seller.id, email: seller.email, role: seller.role };

    // Two concurrent confirm-list-resale calls race the application-level
    // pre-check; the DB partial unique index must let exactly one win.
    const responses = await Promise.all(
      Array.from({ length: 2 }, () =>
        request(app.getHttpServer())
          .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
          .send({ price: '1100', signedXdr: 'signed-xdr' }),
      ),
    );

    const succeeded = responses.filter((res) => res.status === 201);
    const conflicted = responses.filter((res) => res.status === 409);

    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(1);
    expect((conflicted[0].body as { message: string }).message).toMatch(
      /active resale listing/i,
    );

    const activeListings = await prisma.resaleListing.count({
      where: { ticketId: ticket.id, status: 'ACTIVE' },
    });
    expect(activeListings).toBe(1);
  });

  it('removes a revoked ticket’s listing from the marketplace (#379)', async () => {
    // `@IsSignedXdr` only admits base64; StellarService is mocked anyway.
    const signedXdr = Buffer.from('signed-xdr').toString('base64');
    const { seller, organization, ticket } = await seedTicket();
    const organizer = await prisma.user.create({
      data: createUser({
        id: randomUUID(),
        email: `organizer-${randomUUID()}@example.com`,
      }),
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: organizer.id,
        role: 'OWNER',
      },
    });

    signListing(seller, ticket);
    currentUser = { userId: seller.id, email: seller.email, role: seller.role };
    const confirmListRes = await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
      .send({ price: '1100', signedXdr })
      .expect(201);
    const { id: listingId } = confirmListRes.body as { id: string };

    const isListed = async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/tickets/resale')
        .expect(200);
      const { items } = res.body as { items: { id: string }[] };
      return items.some((item) => item.id === listingId);
    };
    expect(await isListed()).toBe(true);

    currentUser = {
      userId: organizer.id,
      email: organizer.email,
      role: organizer.role,
    };
    const revokeRes = await request(app.getHttpServer())
      .post(`/v1/tickets/${ticket.id}/confirm-revoke`)
      .send({ signedXdr })
      .expect(201);
    expect((revokeRes.body as { status: string }).status).toBe('REVOKED');

    expect(await isListed()).toBe(false);
    const listingAfterRevoke = await prisma.resaleListing.findUniqueOrThrow({
      where: { id: listingId },
    });
    expect(listingAfterRevoke.status).toBe('CANCELLED');
  });
});
