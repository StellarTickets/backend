import { ExecutionContext, INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { StellarService } from '../src/stellar/stellar.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import {
  createEvent,
  createOrganization,
  createTicket,
  createTicketType,
  createUser,
} from './factories';

// Requires a real DATABASE_URL (and the rest of .env.example) — PrismaService
// connects on module init, same as test/app.e2e-spec.ts. Not run in CI yet
// since no Postgres/Soroban RPC service is provisioned there.
//
// StellarService is fully mocked via `overrideProvider` so this suite never
// talks to a real Soroban RPC endpoint — every "build"/"confirm" call below
// resolves with canned values, mirroring the module-level `jest.mock` used
// in src/tickets/tickets.service.spec.ts.
//
// Auth is bypassed via `overrideGuard(JwtAuthGuard)`: it attaches a fixed
// `req.user` for whichever caller each request needs, avoiding the need to
// mint a real signed JWT (and the JWT_SECRET that would require).
describe('Resale flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let currentUserId = 'seller-1';

  const mockStellarService = {
    buildListForResaleTx: jest.fn().mockResolvedValue('unsigned-xdr'),
    buildCancelResaleTx: jest.fn().mockResolvedValue('unsigned-xdr'),
    buildBuyResaleTx: jest.fn().mockResolvedValue('unsigned-xdr'),
    submitSignedTransaction: jest
      .fn()
      .mockResolvedValue({ result: null, txHash: '0xresale' }),
  };

  let seller: ReturnType<typeof createUser>;
  let buyer: ReturnType<typeof createUser>;
  let organization: ReturnType<typeof createOrganization>;
  let event: ReturnType<typeof createEvent>;
  let ticketType: ReturnType<typeof createTicketType>;
  let ticket: ReturnType<typeof createTicket>;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = { userId: currentUserId, email: 'x@example.com', role: 'ATTENDEE' };
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();

    prisma = app.get(PrismaService);

    seller = createUser({ id: 'e2e-seller-1', stellarPublicKey: 'G'.repeat(56) });
    buyer = createUser({
      id: 'e2e-buyer-1',
      email: 'buyer@example.com',
      stellarPublicKey: 'G' + '1'.repeat(55),
    });
    organization = createOrganization({ id: 'e2e-org-1' });
    event = createEvent({
      id: 'e2e-event-1',
      organizationId: organization.id,
      chainEventId: 1001n,
      status: 'PUBLISHED',
    });
    ticketType = createTicketType({
      id: 'e2e-tt-1',
      eventId: event.id,
      price: 1_000n,
    });
    ticket = createTicket({
      id: 'e2e-ticket-1',
      eventId: event.id,
      ticketTypeId: ticketType.id,
      ownerId: seller.id,
      chainTicketId: 5001n,
      status: 'VALID',
    });

    await prisma.user.create({ data: seller });
    await prisma.user.create({ data: buyer });
    await prisma.organization.create({ data: organization });
    await prisma.event.create({ data: event });
    await prisma.ticketType.create({ data: ticketType });
    await prisma.ticket.create({ data: ticket });

    currentUserId = seller.id;
  });

  afterEach(async () => {
    // Clean up in FK-dependency order.
    await prisma.resalePriceHistory.deleteMany({});
    await prisma.resaleListing.deleteMany({});
    await prisma.ticket.deleteMany({ where: { id: ticket.id } });
    await prisma.ticketType.deleteMany({ where: { id: ticketType.id } });
    await prisma.event.deleteMany({ where: { id: event.id } });
    await prisma.organization.deleteMany({ where: { id: organization.id } });
    await prisma.user.deleteMany({ where: { id: { in: [seller.id, buyer.id] } } });
    await app.close();
  });

  it('lists a ticket for resale then cancels the listing, restoring VALID/CANCELLED', async () => {
    const server = app.getHttpServer();

    const buildRes = await request(server)
      .post(`/v1/tickets/${ticket.id}/list-resale`)
      .send({ price: '1100' })
      .expect(201);
    expect(buildRes.body.unsignedXdr).toBe('unsigned-xdr');

    const confirmRes = await request(server)
      .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
      .send({ price: '1100', signedXdr: 'signed-xdr' })
      .expect(201);
    expect(confirmRes.body.status).toBe('ACTIVE');

    const listedTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(listedTicket?.status).toBe('RESALE');

    await request(server)
      .post(`/v1/tickets/${ticket.id}/cancel-resale`)
      .expect(201);

    await request(server)
      .post(`/v1/tickets/${ticket.id}/confirm-cancel-resale`)
      .send({ signedXdr: 'signed-xdr' })
      .expect(201);

    const restoredTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(restoredTicket?.status).toBe('VALID');

    const listing = await prisma.resaleListing.findFirst({
      where: { ticketId: ticket.id },
    });
    expect(listing?.status).toBe('CANCELLED');
  });

  it('lists a ticket for resale then a buyer purchases it, transferring ownership', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post(`/v1/tickets/${ticket.id}/list-resale`)
      .send({ price: '1100' })
      .expect(201);
    await request(server)
      .post(`/v1/tickets/${ticket.id}/confirm-list-resale`)
      .send({ price: '1100', signedXdr: 'signed-xdr' })
      .expect(201);

    // Switch the authenticated caller to the buyer for the purchase leg.
    currentUserId = buyer.id;

    await request(server)
      .post(`/v1/tickets/${ticket.id}/buy-resale`)
      .expect(201);

    await request(server)
      .post(`/v1/tickets/${ticket.id}/confirm-buy-resale`)
      .send({ signedXdr: 'signed-xdr' })
      .expect(201);

    const soldTicket = await prisma.ticket.findUnique({
      where: { id: ticket.id },
    });
    expect(soldTicket?.ownerId).toBe(buyer.id);
    expect(soldTicket?.status).toBe('VALID');

    const listing = await prisma.resaleListing.findFirst({
      where: { ticketId: ticket.id },
    });
    expect(listing?.status).toBe('SOLD');
  });
});
