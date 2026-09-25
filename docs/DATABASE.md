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
