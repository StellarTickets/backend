# StellarTickets — Backend

REST API for [StellarTickets](https://github.com/StellarTickets) —
*Secure. Verifiable. Powered by Stellar.*

Built with NestJS + Prisma (PostgreSQL). This service owns organizer/event
metadata, authentication, and the marketplace search surface — it never
custodies ticket ownership itself. The
[`ticketing`](https://github.com/StellarTickets/blockchain) Soroban contract
is the source of truth for who owns a ticket and whether it's valid; this API
reads and writes through it.

## Non-custodial by design

This backend never holds a user's Stellar secret key. Every on-chain action
(publishing an event, issuing/purchasing/transferring/checking in/revoking/
reselling a ticket) is a two-step flow:

1. **`POST /.../<action>`** — the API simulates the contract call against the
   caller's own public key and returns an unsigned, fee-prepared XDR envelope.
2. The caller's wallet (Freighter, etc.) **signs it client-side**.
3. **`POST /.../confirm-<action>`** — the API relays the signed envelope to
   Soroban RPC, polls it to completion, and updates its own read-model
   (`Ticket.status`, `Event.status`, …) to match.

See [`src/stellar/stellar.service.ts`](src/stellar/stellar.service.ts) for
the implementation and [`src/tickets/tickets.service.ts`](src/tickets/tickets.service.ts)
for how each ticket action wires into it.

## Domain model

One flexible schema covers all twelve supported industries (concerts,
flights, sports, festivals, conferences, bus, movie theaters, museums,
tourist attractions, public transport, universities, corporate events) —
`Event.category` is the only industry-specific field. See
[`prisma/schema.prisma`](prisma/schema.prisma).

| Module | Responsibility |
|---|---|
| `auth` | Registration/login, JWT issuance, password hashing (bcrypt) |
| `organizations` | Organizer accounts, membership, the Stellar account that signs on-chain writes |
| `events` | Event/ticket-type CRUD, publishing an event on-chain |
| `tickets` | Issuance, primary sale, transfer, check-in, revocation, resale marketplace |
| `stellar` | The Soroban `ticketing` contract client (see above) |

## Development

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, Soroban RPC config

npx prisma migrate dev
npm run start:dev
```

## Testing

```bash
npm test        # unit tests
npm run lint
```

## Environment

See [`.env.example`](.env.example). `TICKETING_CONTRACT_ID` must point at a
deployed instance of the
[`ticketing`](https://github.com/StellarTickets/blockchain) contract.
`PLATFORM_SIGNER_SECRET` is used only as a disposable source account for
read-only simulations — it never signs a write.

## More documentation

See [`docs/`](docs/README.md) for architecture, database, API, and FAQ.
