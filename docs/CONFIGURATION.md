# Configuration

All environment variables are validated at boot by
`src/config/env.validation.ts` — the app refuses to start rather than
run with a missing or malformed value. See
[`.env.example`](../.env.example) for the full list and
[`docs/AUTHENTICATION.md`](AUTHENTICATION.md) /
[`docs/NON_CUSTODIAL.md`](NON_CUSTODIAL.md) for what `JWT_SECRET` and
`PLATFORM_SIGNER_SECRET` are actually used for.

## Environment variables

<!-- BEGIN GENERATED: env table (npm run docs:env) -->

| Variable | Type | Required | Default | Validated at boot | Description |
| --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | `development \| test \| production` | **required** | `development` | yes | Which NestJS environment the app runs in. Drives logging verbosity and whether development-only behaviour is enabled.
| `OTEL_TRACING_ENABLED` | `true \| false` | optional | `false` | yes | Opt in to HTTP/NestJS OpenTelemetry spans. Off unless literally 'true'. See docs/TRACING.md.
| `OTEL_SERVICE_NAME` | string | optional | `stellar-tickets-backend` \* | yes | Service name attached to exported spans; defaults to stellar-tickets-backend.
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | string | optional | `http://localhost:4318/v1/traces` \* | yes | OTLP HTTP trace collector URL. Defaults to http://localhost:4318/v1/traces.
| `PORT` | integer | **required** | `3000` | yes | TCP port the HTTP server binds. Match it to the `port` in docker-compose.yml when running the API in a container.
| `MAX_ACTIVE_RESALE_LISTINGS_PER_USER` | integer | optional | `5` | yes | Soft cap on how many `ACTIVE` resale listings one seller may hold at once. Listing beyond it is rejected, not queued. See docs/RESALE_EXPIRY.md.
| `DATABASE_URL` | string | **required** | — | yes | PostgreSQL connection string for the Prisma client. This is the single system of record; see docs/DATABASE.md.
| `RATE_LIMIT_STORE` | `memory \| redis` | optional | `memory` | yes | Where rate-limit counters live. `memory` (default) is per-process; `redis` shares them across instances. See docs/RATE_LIMITING.md.
| `CACHE_DRIVER` | `memory \| redis` | optional | `memory` | yes | Where cached entries live. `memory` (default) is per-process; `redis` shares them across instances. See docs/CACHING.md.
| `WEBHOOK_QUEUE_ENABLED` | `true \| false` | optional | `false` | yes | Enables the BullMQ-backed outbound webhook queue. Kept as the literal strings 'true'/'false' (like the feature flags) because implicit conversion would turn the string 'false' into boolean true. Off unless 'true'. See docs/WEBHOOKS.md.
| `WEBHOOK_QUEUE_ATTEMPTS` | integer | optional | `5` \* | yes | Total delivery attempts per webhook, the first included. Default 5.
| `WEBHOOK_QUEUE_BACKOFF_MS` | integer | optional | `5000` \* | yes | Delay before the first webhook retry, doubling on each further retry. Default 5000.
| `SCHEDULER_ENABLED` | `true \| false` | optional | `true` | yes | Set to 'false' to switch off every cron job registered through SchedulerModule. On unless 'false'. See docs/SCHEDULER.md.
| `REDIS_URL` | string | conditional | — | yes (when required) | Redis connection URL (e.g. redis://localhost:6379). Required when RATE_LIMIT_STORE=redis, CACHE_DRIVER=redis or WEBHOOK_QUEUE_ENABLED=true.
| `JWT_SECRET` | string (min 32 chars) | **required** | — | yes | Secret used to sign and verify JWT access tokens. Must be at least 32 characters. Rotating it invalidates every issued token. See docs/AUTHENTICATION.md.
| `APP_URL` | string | **required** | `http://localhost:3001` | yes | Public origin this API is reached at, e.g. http://localhost:3001. Used as the CORS allow-list and to build links in outbound email/webhooks.
| `SOROBAN_RPC_URL` | string | **required** | — | yes | Soroban RPC endpoint the StellarService submits contract calls through.
| `STELLAR_NETWORK` | `testnet \| futurenet \| mainnet` | **required** | `testnet` | yes | Which Stellar network every contract call targets. Must match the network the `ticketing` contract is deployed on and the one user wallets are set to, or every submit will fail.
| `TICKETING_CONTRACT_ID` | string | **required** | — | yes | Deployed `ticketing` contract's C... address.
| `PLATFORM_SIGNER_SECRET` | string | **required** | — | yes | Platform signer used for contract calls submitted on behalf of the backend itself (e.g. relaying an organizer's already-authorized op).
| `OFFLINE_SIGNING_KEY_ID` | string | **required** | `2026-01` | yes | Key id of the Ed25519 key currently used to sign offline verification tokens. Must have a matching entry in OFFLINE_SIGNING_PUBLIC_KEYS.
| `OFFLINE_SIGNING_PRIVATE_KEY` | string | **required** | — | yes | PEM-encoded Ed25519 private key used to sign offline verification tokens. See docs/OFFLINE_VERIFICATION.md for generation and rotation.
| `OFFLINE_SIGNING_PUBLIC_KEYS` | string | **required** | — | yes | JSON map of key id -> PEM-encoded Ed25519 public key. Every key a scanner should still accept, current and retired, so tokens signed before a rotation keep verifying until they expire.
| `PENDING_TX_RETENTION_MINUTES` | integer | optional | `60` | yes | How long a PendingTx row (build-transaction intent) stays valid before it's considered expired and eligible for cleanup.
| `PENDING_TX_CLEANUP_INTERVAL_MINUTES` | integer | optional | `15` | yes | How often the PendingTx cleanup job runs, in minutes.
| `IDEMPOTENCY_KEY_TTL_MINUTES` | integer | optional | `15` | yes | How long a cached response for an Idempotency-Key stays valid, in minutes, before a repeated key is treated as a new request.
| `SCAN_RATE_LIMIT_MAX` | integer | optional | `10` | **no** | Scans allowed per window per device, for ticket check-in abuse prevention. See docs/RATE_LIMITING.md.
| `SCAN_RATE_LIMIT_WINDOW_MS` | integer | optional | `60000` | **no** | Length of the scan rate-limit window, in milliseconds.
| `FEATURE_FEE_BUMP` | boolean (string) | optional | `false` | **no** | Experimental: enable the fee-bump path. Off unless exactly 'true'. See docs/FEATURE_FLAGS.md.
| `FEATURE_INDEXER` | boolean (string) | optional | `false` | **no** | Experimental: enable the chain indexer. Off unless exactly 'true'. See docs/FEATURE_FLAGS.md.
| \* | | | | | The value used in code when the variable is unset. Commented out in `.env.example` because it only applies once the related optional feature is enabled. |

<!-- END GENERATED: env table -->

The table above is generated from `src/config/env.validation.ts` and
`.env.example` by `npm run docs:env`. Do not edit it by hand — edit one of
those two files and re-run the script. `npm run docs:check` fails if the two
sources have drifted apart, so a variable added to one but not the other
cannot land unnoticed.

**Validated at boot** means the app refuses to start when the value is missing
or malformed. A handful of variables are read directly by `ConfigService`
without going through validation — they are flagged **no** above. A typo in
one of those fails *silently* and the feature simply stays on its default, so
check the spelling if a flag or limit does not take effect.
