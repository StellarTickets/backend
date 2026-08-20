# FAQ

**Why doesn't this API ever hold a user's Stellar secret key?**
Because it's non-custodial by design — see `docs/ARCHITECTURE.md` and
`src/stellar/stellar.service.ts` for the build/sign/submit pattern
every write follows.

**What happens if a `confirm-*` call is retried after the transaction
already landed?**
Soroban RPC will reject a duplicate submission of the same signed
envelope; the caller should treat that as success if `getTransaction`
shows the hash already succeeded, rather than retrying `build-*` again.

**Why is `TicketType.price` a string in the API, not a number?**
It's a `BigInt` in Postgres to match the contract's `i128`, and
JavaScript numbers lose precision above 2^53 — strings round-trip
exactly through JSON.
