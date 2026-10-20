import type { Event, TicketType } from '@prisma/client';

let eventCounter = 0;
let ticketTypeCounter = 0;

/** Returns a fully-valid `Event` row, with realistic defaults, merged with `overrides`. */
export function createEvent(overrides: Partial<Event> = {}): Event {
  const n = ++eventCounter;
  const id = overrides.id ?? `event-${n}`;
  return {
    id,
    organizationId: `org-${n}`,
    name: `Test Event ${n}`,
    slug: `test-event-${n}-${id}`,
    description: `Description for test event ${n}`,
    imageUrl: null,
    category: 'CONCERTS',
    venue: 'Madison Square Garden',
    timezone: 'America/New_York',
    startsAt: new Date('2026-12-01T20:00:00.000Z'),
    endsAt: new Date('2026-12-01T23:00:00.000Z'),
    chainEventId: null,
    chainEventIdReservedAt: null,
    publishedTxHash: null,
    maxResaleMultiplierBps: 11_000,
    royaltyBps: 500,
    status: 'DRAFT',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    // #207 — soft-delete marker (null = live).
    deletedAt: null,
    ...overrides,
  };
}

/** Returns a fully-valid `TicketType` row, with realistic defaults, merged with `overrides`. */
export function createTicketType(
  overrides: Partial<TicketType> = {},
): TicketType {
  const n = ++ticketTypeCounter;
  return {
    id: `tt-${n}`,
    eventId: `event-${n}`,
    name: 'General Admission',
    price: 1_000n,
    quantityTotal: 100,
    quantityIssued: 0,
    saleStartsAt: null,
    saleEndsAt: null,
    isHidden: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
