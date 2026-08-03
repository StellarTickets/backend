# Why non-custodial, specifically

Every write to the `ticketing` contract requires `require_auth()` from
the account taking the action — the contract has no concept of an
admin override for ticket ownership. That means the only way this API
could act on a user's behalf is by holding their private key, which
would make StellarTickets a single point of failure for every ticket
on the platform.

Instead, `StellarService.build*Tx` methods return unsigned XDR built
against the caller's own public key, and the caller's wallet signs it.
The API only ever submits transactions someone else already signed.
`PLATFORM_SIGNER_SECRET` exists only for read-only simulations
(`verify_ticket`, `get_event`), which don't call `require_auth` at
all — see `src/stellar/stellar.service.ts`.
