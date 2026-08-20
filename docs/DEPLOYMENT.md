# Deployment checklist

1. `npx tsc --noEmit` — clean typecheck
2. `npx eslint "src/**/*.ts"` — no lint warnings
3. `npm test` — full suite green
4. `npx prisma migrate deploy` against the production database
5. Set `TICKETING_CONTRACT_ID` to the mainnet-deployed contract address
6. Set `STELLAR_NETWORK=mainnet` and a production `SOROBAN_RPC_URL`
7. Rotate `JWT_SECRET` and `PLATFORM_SIGNER_SECRET` out of any shared
   `.env` file into a real secrets manager before going live
