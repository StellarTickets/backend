# Configuration

All environment variables are validated at boot by
`src/config/env.validation.ts` — the app refuses to start rather than
run with a missing or malformed value. See
[`.env.example`](../.env.example) for the full list and
[`docs/AUTHENTICATION.md`](AUTHENTICATION.md) /
[`docs/NON_CUSTODIAL.md`](NON_CUSTODIAL.md) for what `JWT_SECRET` and
`PLATFORM_SIGNER_SECRET` are actually used for.
