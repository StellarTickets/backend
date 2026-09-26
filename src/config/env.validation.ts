import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  /// Which NestJS environment the app runs in. Drives logging verbosity and
  /// whether development-only behaviour is enabled.
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: string;

  /// Opt in to HTTP/NestJS OpenTelemetry spans. Off unless literally 'true'.
  /// See docs/TRACING.md.
  @IsIn(['true', 'false'])
  @IsOptional()
  OTEL_TRACING_ENABLED?: string;

  /// Service name attached to exported spans; defaults to stellar-tickets-backend.
  @IsString()
  @IsOptional()
  OTEL_SERVICE_NAME?: string;

  /// OTLP HTTP trace collector URL. Defaults to http://localhost:4318/v1/traces.
  @IsString()
  @IsOptional()
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;

  /// TCP port the HTTP server binds. Match it to the `port` in docker-compose.yml
  /// when running the API in a container.
  @IsInt()
  PORT!: number;

  /// Soft cap on how many `ACTIVE` resale listings one seller may hold at
  /// once. Listing beyond it is rejected, not queued. See docs/RESALE_EXPIRY.md.
  @IsInt()
  @IsOptional()
  MAX_ACTIVE_RESALE_LISTINGS_PER_USER?: number;

  /// PostgreSQL connection string for the Prisma client. This is the single
  /// system of record; see docs/DATABASE.md.
  @IsString()
  DATABASE_URL!: string;

  /// Where rate-limit counters live. `memory` (default) is per-process;
  /// `redis` shares them across instances. See docs/RATE_LIMITING.md.
  @IsIn(['memory', 'redis'])
  @IsOptional()
  RATE_LIMIT_STORE?: string;

  /// Where cached entries live. `memory` (default) is per-process; `redis`
  /// shares them across instances. See docs/CACHING.md.
  @IsIn(['memory', 'redis'])
  @IsOptional()
  CACHE_DRIVER?: string;

  /// Enables the BullMQ-backed outbound webhook queue. Kept as the literal
  /// strings 'true'/'false' (like the feature flags) because implicit
  /// conversion would turn the string 'false' into boolean true. Off unless
  /// 'true'. See docs/WEBHOOKS.md.
  @IsIn(['true', 'false'])
  @IsOptional()
  WEBHOOK_QUEUE_ENABLED?: string;

  /// Total delivery attempts per webhook, the first included. Default 5.
  @IsInt()
  @IsOptional()
  WEBHOOK_QUEUE_ATTEMPTS?: number;

  /// Delay before the first webhook retry, doubling on each further retry.
  /// Default 5000.
  @IsInt()
  @IsOptional()
  WEBHOOK_QUEUE_BACKOFF_MS?: number;

  /// Set to 'false' to switch off every cron job registered through
  /// SchedulerModule. On unless 'false'. See docs/SCHEDULER.md.
  @IsIn(['true', 'false'])
  @IsOptional()
  SCHEDULER_ENABLED?: string;

  /// Redis connection URL (e.g. redis://localhost:6379). Required when
  /// RATE_LIMIT_STORE=redis, CACHE_DRIVER=redis or WEBHOOK_QUEUE_ENABLED=true.
  @ValidateIf(
    (env: EnvironmentVariables) =>
      env.RATE_LIMIT_STORE === 'redis' ||
      env.CACHE_DRIVER === 'redis' ||
      env.WEBHOOK_QUEUE_ENABLED === 'true',
  )
  @IsString()
  REDIS_URL?: string;

  /// Secret used to sign and verify JWT access tokens. Must be at least 32
  /// characters. Rotating it invalidates every issued token. See
  /// docs/AUTHENTICATION.md.
  @IsString()
  @MinLength(32)
  JWT_SECRET!: string;

  /// Public origin this API is reached at, e.g. http://localhost:3001. Used
  /// as the CORS allow-list and to build links in outbound email/webhooks.
  @IsString()
  APP_URL!: string;

  /// Soroban RPC endpoint the StellarService submits contract calls through.
  @IsString()
  SOROBAN_RPC_URL!: string;

  /// Which Stellar network every contract call targets. Must match the network
  /// the `ticketing` contract is deployed on and the one user wallets are set
  /// to, or every submit will fail.
  @IsIn(['testnet', 'futurenet', 'mainnet'])
  STELLAR_NETWORK!: string;

  /// Deployed `ticketing` contract's C... address.
  @IsString()
  TICKETING_CONTRACT_ID!: string;

  /// Platform signer used for contract calls submitted on behalf of the
  /// backend itself (e.g. relaying an organizer's already-authorized op).
  @IsString()
  PLATFORM_SIGNER_SECRET!: string;

  /// Key id of the Ed25519 key currently used to sign offline verification
  /// tokens. Must have a matching entry in OFFLINE_SIGNING_PUBLIC_KEYS.
  @IsString()
  OFFLINE_SIGNING_KEY_ID!: string;

  /// PEM-encoded Ed25519 private key used to sign offline verification
  /// tokens. See docs/OFFLINE_VERIFICATION.md for generation and rotation.
  @IsString()
  OFFLINE_SIGNING_PRIVATE_KEY!: string;

  /// JSON map of key id -> PEM-encoded Ed25519 public key. Every key a
  /// scanner should still accept, current and retired, so tokens signed
  /// before a rotation keep verifying until they expire.
  @IsString()
  OFFLINE_SIGNING_PUBLIC_KEYS!: string;

  /// How long a PendingTx row (build-transaction intent) stays valid before
  /// it's considered expired and eligible for cleanup.
  @IsInt()
  @IsOptional()
  PENDING_TX_RETENTION_MINUTES?: number;

  /// How often the PendingTx cleanup job runs, in minutes.
  @IsInt()
  @IsOptional()
  PENDING_TX_CLEANUP_INTERVAL_MINUTES?: number;

  /// How long a cached response for an Idempotency-Key stays valid, in
  /// minutes, before a repeated key is treated as a new request.
  @IsInt()
  @IsOptional()
  IDEMPOTENCY_KEY_TTL_MINUTES?: number;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  return validated;
}
