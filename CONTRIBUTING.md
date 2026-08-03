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
npm test
npm run build
```

## Commit style

Keep commits scoped to one logical change with an imperative subject
line.
