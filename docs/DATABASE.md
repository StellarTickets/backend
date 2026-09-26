# Database

Postgres via Prisma. Schema: [`prisma/schema.prisma`](../prisma/schema.prisma).

## Key relationships

- `User` — `OrganizationMember` (many-to-many via join table) — `Organization`
- `Organization` — `Event` — `TicketType` — `Ticket`
- `Ticket.ownerId` -> `User` (the current owner, kept in sync with the
  on-chain owner on every write path and by `verify`)
- `ResaleListing` — one row per listing attempt, `ticketId` + `status`

## Migrations

```bash
npx prisma migrate dev --name <description>
npx prisma migrate deploy   # production
```

`chainEventId` and `chainTicketId` are unique `BigInt` columns mapping
1:1 to the on-chain `u64` ids — see `docs/ARCHITECTURE.md` for why the
chain remains the source of truth despite this cache.

## Seat uniqueness per event (#211)

A seat may be issued only once per event. Enforced by a **partial**
unique index (raw SQL — Prisma cannot express `WHERE`):

```sql
CREATE UNIQUE INDEX "Ticket_eventId_seat_partial_key"
  ON "Ticket"("eventId", "seat")
  WHERE "seat" <> 'unassigned';
```

- `seat = 'unassigned'` (the default) is excluded, so general-admission
  tickets never collide.
- Any assigned seat (e.g. `A1`) collides on duplicate `(eventId, seat)`
  with a `P2002` that `TicketsService` translates to `409 Conflict`.
- Migration: `prisma/migrations/20260926090000_ticket_seat_partial_unique/`.
  Tested against the schema: duplicate assigned seats fail, repeated
  `'unassigned'` rows succeed.

## Ticket owner/status index (#213)

`GET /tickets/mine` filters by owner with an optional `?status=` filter:

```
GET /tickets/mine?status=VALID
```

Covered by a composite index declared in the schema and migration:

```prisma
@@index([ownerId, status]) // on Ticket
```

```sql
CREATE INDEX "Ticket_ownerId_status_idx" ON "Ticket"("ownerId", "status");
```

Migration: `prisma/migrations/20260926100000_ticket_owner_status_index/`.
Supports `WHERE "ownerId" = $1 [AND "status" = $2] ORDER BY "createdAt" DESC`
as a single index scan.

## Soft-delete for Event and Organization (#207)

`Event.deletedAt` and `Organization.deletedAt` (`NULL` = live) replace
hard deletes in all app write paths (`DELETE /events/:eventId`,
`DELETE /organizations/:id`, plus `POST .../restore` to undo).

- All read paths filter `deletedAt: null` (`findMine`, `findOne`,
  `getWithOrg`, `findPublished`, `findForOrganization`, reminders).
  Single-row lookups treat a soft-deleted row as `404 Not Found`.
- **Cascade behaviour:** the FK `ON DELETE CASCADE` rules
  (`Organization -> Event -> TicketType -> Ticket`) are unchanged and
  still apply to *hard* deletes (manual ops, `migrate reset`). A
  soft-delete does **not** cascade at the DB level and does **not**
  delete child rows: tickets, gates, promo codes and reminders of a
  soft-deleted event/org remain in place for audit/reconciliation but
  are hidden wherever their parent is filtered out (`findPublished`
  additionally requires `organization.deletedAt IS NULL`).
- Migration: `prisma/migrations/20260926110000_soft_delete_event_organization/`.

## Audit log (#209)

`AuditLog` (`prisma/migrations/20260926120000_audit_log/`) stores
**actor, action, entity and timestamp** for sensitive actions:

| Column | Meaning |
| --- | --- |
| `actorId` | `User.id` of the caller (`NULL` for system/cron) |
| `action` | e.g. `organization.create`, `event.publish`, `ticket.revoke` |
| `entityType` | e.g. `Organization`, `Event`, `Ticket` |
| `entityId` | id of the affected row |
| `metadata` | optional JSON context (slug, txHash, ticketIds, …) |
| `createdAt` | timestamp (default `now()`) |

Written (best-effort, never fails the primary write) by
`AuditService` (`src/audit/`) for org actions
(`organization.create/delete/restore`), event actions
(`event.create/publish/unpublish/delete/restore`) and revoke actions
(`ticket.revoke`, `ticket.revoke_batch`).

## BigInt Serialization Strategy

Native JavaScript `BigInt` values (used by Prisma for 64-bit/128-bit integer columns like `chainEventId`, `chainTicketId`, and `price`) are not natively JSON-serializable and cause `TypeError: Do not know how to serialize a BigInt` when processed by standard `JSON.stringify()`.

To ensure consistent string output and prevent runtime crashes:

1. **NestJS Response Interceptor (`BigIntSerializerInterceptor`):**
   - Registered globally in `AppModule`.
   - Recursively traverses response objects and converts all `bigint` primitives into decimal string representations (`"1234567890"`).
   - Preserves primitives, arrays, `null`, `undefined`, and `Date` instances.

2. **`BigInt.prototype.toJSON` Polyfill:**
   - Monkey-patches `BigInt.prototype.toJSON` to return `this.toString()`.
   - Ensures out-of-pipeline `JSON.stringify(obj)` calls (e.g. loggers, Redis serialization) output stringified BigInts consistently.

## Backup and restore

All commands below assume a local PostgreSQL instance reachable at
`postgresql://stellartickets:stellartickets@localhost:5432/stellartickets`
(the default from `docker-compose.yml`). Substitute your `DATABASE_URL`
as needed, and prefix with `docker exec -i <container> ` when the
database runs inside a container (e.g. `docker compose ps` to get the
name).

### Logical backup (`pg_dump`)

Create a plain-text SQL dump:

```bash
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql
```

Restore from a plain-text dump (drops and recreates tables via the
`--clean` and `--if-exists` flags):

```bash
psql "$DATABASE_URL" --clean --if-exists -f backup_*.sql
```

### Compressed/custom-format backup (`pg_dump` + `pg_restore`)

Create a compressed dump (recommended for larger databases):

```bash
pg_dump --format=custom "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).dump
```

Restore from a custom-format dump:

```bash
pg_restore --clean --if-exists --no-owner --verbose "$DATABASE_URL" backup_*.dump
```

### Database dump via Prisma (schema introspection)

For a quick schema-only dump without touching data, Prisma can introspect
the live database and write a Prisma-compatible schema:

```bash
npx prisma db pull       # introspect the live database into schema.prisma
```

> ⚠ **Prisma migrate is the canonical source of truth for schema changes** —
> `prisma db pull` is for introspection only and does not replace version-controlled
> migrations.

### Quick restore from Prisma migrations (dev)

To completely reset the development database to the latest migration
state and reseed:

```bash
npm run db:reset
```

This is equivalent to `prisma migrate reset --force`, which drops the
database, applies all migrations from `prisma/migrations/`, and runs the
seed script defined in `prisma/seed.ts`.
