# Architecture

## Module layout

- `auth` — registration, login, JWT issuance and validation
- `users` — profile, wallet connect, email lookup for recipient resolution
- `organizations` — organizer accounts and membership
- `events` — event/ticket-type CRUD and on-chain publishing
- `tickets` — the full ticket lifecycle (issue, purchase, transfer,
  check-in, revoke, resale)
- `stellar` — the only module that talks to Soroban RPC

## The non-custodial write path

Every on-chain write follows the same two-step shape:

1. `build*Tx` in `StellarService` simulates the call against the
   caller's own public key and returns an unsigned XDR envelope.
2. The caller's wallet signs it client-side.
3. `submitSignedTransaction` relays the signed envelope and polls it
   to completion.

No other module calls Soroban RPC directly — they all go through
`StellarService`, which keeps the "we never hold a key" invariant in
one place.
