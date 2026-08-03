# Testing

Every service is unit tested with Prisma, `OrganizationsService`, and
`StellarService` mocked out — no real database or Soroban RPC call
happens in `npm test`. `StellarService` is mocked at the module level
(`jest.mock('../stellar/stellar.service', ...)`) rather than imported
for real, because `@stellar/stellar-sdk` ships transitive ESM-only
dependencies that need a wider `transformIgnorePatterns` to parse.

Run the suite:

```bash
npm test
```

For a true end-to-end check against a real Postgres and Soroban RPC,
see `test/app.e2e-spec.ts` (not run in CI yet — no database service is
provisioned there).
