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
import { OptionalJwtAuthGuard } from '../src/auth/guards/optional-jwt-auth.guard';
import type { CurrentUserPayload } from '../src/auth/decorators/current-user.decorator';
import { createOrganization, createUser } from './factories';

// Requires a real DATABASE_URL — same constraint as app.e2e-spec.ts. Covers
// the organizer-facing event lifecycle: create draft -> add ticket type ->
// publish (build + confirm), asserting the event's status transitions along
// the way (#222).
describe('Event lifecycle (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let currentUser: CurrentUserPayload | null;

  const mockStellarService = {
    buildCreateEventTx: jest.fn().mockResolvedValue('unsigned-xdr'),
    submitSignedTransaction: jest
      .fn()
      .mockResolvedValue({ txHash: 'a'.repeat(64) }),
    getEvent: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StellarService)
      .useValue(mockStellarService)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = currentUser;
          return true;
        },
      })
      // `GET /events/:id` is guarded by the optional variant: set `req.user`
      // only when the test is acting as a signed-in user, so `currentUser =
      // null` exercises the anonymous path (#372).
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({
        canActivate: (context: import('@nestjs/common').ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          if (currentUser) req.user = currentUser;
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

  /** Seeds a fresh organizer + organization (organizer as OWNER) and signs them in. */
  async function seedOrganizer() {
    const organizer = await prisma.user.create({
      data: createUser({
        id: randomUUID(),
        email: `organizer-${randomUUID()}@example.com`,
        stellarPublicKey: `G${randomUUID().replace(/-/g, '').toUpperCase().padEnd(55, 'A')}`,
      }),
    });
    const organization = await prisma.organization.create({
      data: createOrganization({
        id: randomUUID(),
        slug: `org-${randomUUID()}`,
      }),
    });
    await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: organizer.id,
        role: 'OWNER',
      },
    });
    currentUser = {
      userId: organizer.id,
      email: organizer.email,
      role: organizer.role,
    };
    return { organizer, organization };
  }

  /** Creates a DRAFT event through the API for the currently signed-in organizer. */
  async function createDraftEvent(organizationId: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/v1/organizations/${organizationId}/events`)
      .send({
        name: `Test Concert ${randomUUID()}`,
        category: 'CONCERTS',
        venue: 'Test Arena',
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    return res.body.id as string;
  }

  it('creates a draft event, adds a ticket type, then publishes it', async () => {
    const { organization } = await seedOrganizer();

    // Step 1: create the event as a DRAFT.
    const eventId = await createDraftEvent(organization.id);

    // Step 2: add a ticket type — required before the event can be published.
    const ticketTypeRes = await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/ticket-types`)
      .send({
        name: 'General Admission',
        price: '1000',
        quantityTotal: 100,
      })
      .expect(201);

    expect(ticketTypeRes.body.eventId).toBe(eventId);
    expect(ticketTypeRes.body.name).toBe('General Admission');

    // Step 3: build the publish transaction — event stays DRAFT with a
    // reserved chainEventId until the signed XDR is confirmed.
    const buildPublishRes = await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/publish`)
      .expect(201);

    expect(buildPublishRes.body.unsignedXdr).toBe('unsigned-xdr');

    const eventAfterBuild = await prisma.event.findUniqueOrThrow({
      where: { id: eventId },
    });
    expect(eventAfterBuild.status).toBe('DRAFT');
    expect(eventAfterBuild.chainEventId).not.toBeNull();

    mockStellarService.getEvent.mockResolvedValue({
      eventId: eventAfterBuild.chainEventId!,
      organizer: organization.stellarAccount,
    });

    // Step 4: confirm publish — event flips to PUBLISHED.
    const confirmPublishRes = await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/confirm-publish`)
      .send({ signedXdr: 'signed-xdr' })
      .expect(201);

    expect(confirmPublishRes.body.status).toBe('PUBLISHED');

    // Follow-up GET reflects the same, persisted state.
    const getRes = await request(app.getHttpServer())
      .get(`/v1/events/${eventId}`)
      .expect(200);
    expect(getRes.body.status).toBe('PUBLISHED');
  });

  it('rejects adding a ticket type once the event is published (#371)', async () => {
    const { organization } = await seedOrganizer();
    const eventId = await createDraftEvent(organization.id);
    // The publish transition itself is covered above; flip the status directly.
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED' },
    });

    await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/ticket-types`)
      .send({ name: 'Late Release', price: '1000', quantityTotal: 10 })
      .expect(400);

    const count = await prisma.ticketType.count({ where: { eventId } });
    expect(count).toBe(0);
  });

  describe('event visibility (#372)', () => {
    it('hides a draft from anonymous callers but shows it to a member', async () => {
      const { organization } = await seedOrganizer();
      const eventId = await createDraftEvent(organization.id);

      // Signed in as the owning organizer: the draft is visible.
      await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .expect(200);

      // Anonymous: the draft reads as not-found.
      currentUser = null;
      await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .expect(404);
    });

    it('shows a published event to anonymous callers', async () => {
      const { organization } = await seedOrganizer();
      const eventId = await createDraftEvent(organization.id);
      await prisma.event.update({
        where: { id: eventId },
        data: { status: 'PUBLISHED' },
      });

      currentUser = null;
      await request(app.getHttpServer())
        .get(`/v1/events/${eventId}`)
        .expect(200);
    });
  });

  it('serializes BigInt columns as decimal strings (#373)', async () => {
    const { organization } = await seedOrganizer();
    const eventId = await createDraftEvent(organization.id);
    await request(app.getHttpServer())
      .post(`/v1/events/${eventId}/ticket-types`)
      .send({ name: 'General Admission', price: '1000', quantityTotal: 100 })
      .expect(201);
    // chainEventId is @unique, so pick one unlikely to clash with another run.
    const chainEventId = BigInt(Math.floor(Math.random() * 1_000_000_000) + 1);
    await prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED', chainEventId },
    });

    // Event detail exposes the on-chain id (a BigInt) as a decimal string.
    const detail = await request(app.getHttpServer())
      .get(`/v1/events/${eventId}`)
      .expect(200);
    expect(detail.body.chainEventId).toBe(chainEventId.toString());
    expect(typeof detail.body.chainEventId).toBe('string');

    // The public listing returns ticket types; `price` is a BigInt column.
    const list = await request(app.getHttpServer())
      .get('/v1/events')
      .query({ limit: 100 })
      .expect(200);
    const listed = (
      list.body.items as Array<{
        id: string;
        ticketTypes: Array<{ price: unknown }>;
      }>
    ).find((event) => event.id === eventId);

    expect(listed).toBeDefined();
    expect(listed!.ticketTypes[0].price).toBe('1000');
    expect(typeof listed!.ticketTypes[0].price).toBe('string');
  });
});
