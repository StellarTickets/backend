import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';
import { API_PREFIX_PATTERN } from './api-prefix';
import { getJwtSecretProblems, JWT_SECRET_MIN_LENGTH } from './jwt-secret';
import { SECRET_PROVIDER_KINDS } from './secrets/secret-provider';
import { getRpcNetworkProblems, STELLAR_NETWORKS } from './stellar-networks';

class EnvironmentVariables {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV!: string;

  @IsInt()
  PORT!: number;

  /// Optional path every route is mounted under (e.g. `api/v1`), for hosting
  /// behind a reverse-proxy path. Health routes stay at the root.
  @IsOptional()
  @Matches(API_PREFIX_PATTERN, {
    message: 'API_PREFIX must be URL path segments such as "api" or "api/v1"',
  })
  API_PREFIX?: string;

  @IsInt()
  @IsOptional()
  MAX_ACTIVE_RESALE_LISTINGS_PER_USER?: number;

  @IsString()
  DATABASE_URL!: string;

  /// Where secrets such as JWT_SECRET are read from: `env` (default),
  /// `file` (`<KEY>_FILE` paths) or `custom` (a provider passed to
  /// `SecretsModule.forRoot`). See docs/CONFIGURATION.md.
  @IsOptional()
  @IsIn(SECRET_PROVIDER_KINDS)
  SECRETS_PROVIDER?: string;

  /// Required when SECRETS_PROVIDER is `env` (the default).
  @ValidateIf((o: EnvironmentVariables) => secretsProvider(o) === 'env')
  @IsString()
  @MinLength(JWT_SECRET_MIN_LENGTH)
  JWT_SECRET?: string;

  /// Path of the file holding JWT_SECRET; required when SECRETS_PROVIDER=file.
  @ValidateIf((o: EnvironmentVariables) => secretsProvider(o) === 'file')
  @IsString()
  JWT_SECRET_FILE?: string;

  @IsString()
  APP_URL!: string;

  /// Soroban RPC endpoint the StellarService submits contract calls through.
  @IsString()
  SOROBAN_RPC_URL!: string;

  @IsIn(STELLAR_NETWORKS)
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

function secretsProvider(env: EnvironmentVariables): string {
  return env.SECRETS_PROVIDER ?? 'env';
}

/** Checks that span several variables, run once each field is well-formed. */
function crossFieldProblems(env: EnvironmentVariables): string[] {
  const problems = getRpcNetworkProblems(
    env.SOROBAN_RPC_URL,
    env.STELLAR_NETWORK,
  );
  // Secrets resolved through another provider are checked when the provider
  // resolves them (see src/auth/jwt-secret.module.ts).
  if (secretsProvider(env) === 'env' && env.JWT_SECRET !== undefined) {
    problems.push(...getJwtSecretProblems(env.JWT_SECRET, env.NODE_ENV));
  }
  return problems;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  const problems = crossFieldProblems(validated);
  if (problems.length > 0) {
    throw new Error(
      `Invalid environment configuration: ${problems.join('; ')}`,
    );
  }

  return validated;
}
