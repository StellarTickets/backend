# Contributing to StellarTickets/backend

## Development setup

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run start:dev
```

## Before opening a PR

```bash
npx tsc --noEmit
npx eslint "src/**/*.ts"
npm run audit:check
npm test
npm run build
```

## Dependency audit policy

CI runs `npm run audit:check`, which runs `npm audit --omit=dev` and fails
the build on any **high** or **critical** severity vulnerability in a
production dependency. Advisories below that threshold (low, moderate) do
not fail the build.

If a high/critical advisory has no fix available yet and the affected code
path isn't reachable, add its GHSA id to `scripts/audit-allowlist.json`
with a documented reason instead of ignoring the failure.

## Commit style

Keep commits scoped to one logical change with an imperative subject
line.
