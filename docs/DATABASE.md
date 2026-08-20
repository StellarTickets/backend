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
