# Input validation

Every DTO uses `class-validator` decorators, enforced globally by the
`ValidationPipe` registered in `main.ts` with `whitelist: true` and
`forbidNonWhitelisted: true` — any field not declared on a DTO is
stripped, and any extra field in the request body causes a 400 rather
than being silently ignored.

`IsStellarPublicKey` (in `src/common/decorators`) validates the
ed25519 checksum via `@stellar/stellar-sdk`'s `StrKey`, not a regex —
a string that merely looks like a Stellar address but fails the
checksum is rejected before it ever reaches a service.
