import 'reflect-metadata';
import { validate } from './env.validation';

function validConfig(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'test',
    PORT: 3000,
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'x'.repeat(32),
    APP_URL: 'http://localhost:3001',
    SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
    STELLAR_NETWORK: 'testnet',
    TICKETING_CONTRACT_ID: 'C'.repeat(56),
    PLATFORM_SIGNER_SECRET: 'S'.repeat(56),
    OFFLINE_SIGNING_KEY_ID: '2026-01',
    OFFLINE_SIGNING_PRIVATE_KEY:
      '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
    OFFLINE_SIGNING_PUBLIC_KEYS:
      '{"2026-01":"-----BEGIN PUBLIC KEY-----\\nfake\\n-----END PUBLIC KEY-----\\n"}',
    ...overrides,
  };
}

describe('env.validate', () => {
  it('accepts a fully populated, well-formed config', () => {
    expect(() => validate(validConfig())).not.toThrow();
  });

  it('rejects an unrecognized NODE_ENV', () => {
    expect(() => validate(validConfig({ NODE_ENV: 'staging' }))).toThrow();
  });

  it('rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => validate(validConfig({ JWT_SECRET: 'too-short' }))).toThrow();
  });

  it('rejects an unrecognized STELLAR_NETWORK', () => {
    expect(() =>
      validate(validConfig({ STELLAR_NETWORK: 'devnet' })),
    ).toThrow();
  });

  it('defaults to the in-memory rate-limit store without a REDIS_URL', () => {
    expect(() =>
      validate(validConfig({ RATE_LIMIT_STORE: 'memory' })),
    ).not.toThrow();
  });

  it('accepts the redis rate-limit store when REDIS_URL is set', () => {
    expect(() =>
      validate(
        validConfig({
          RATE_LIMIT_STORE: 'redis',
          REDIS_URL: 'redis://localhost:6379',
        }),
      ),
    ).not.toThrow();
  });

  it('requires REDIS_URL when the rate-limit store is redis', () => {
    expect(() =>
      validate(validConfig({ RATE_LIMIT_STORE: 'redis' })),
    ).toThrow();
  });

  it('rejects an unrecognized RATE_LIMIT_STORE', () => {
    expect(() =>
      validate(validConfig({ RATE_LIMIT_STORE: 'memcached' })),
    ).toThrow();
  });

  it('defaults to the in-memory cache without a REDIS_URL', () => {
    expect(() =>
      validate(validConfig({ CACHE_DRIVER: 'memory' })),
    ).not.toThrow();
  });

  it('accepts the redis cache driver when REDIS_URL is set', () => {
    expect(() =>
      validate(
        validConfig({
          CACHE_DRIVER: 'redis',
          REDIS_URL: 'redis://localhost:6379',
        }),
      ),
    ).not.toThrow();
  });

  it('requires REDIS_URL when the cache driver is redis', () => {
    expect(() => validate(validConfig({ CACHE_DRIVER: 'redis' }))).toThrow();
  });

  it('rejects an unrecognized CACHE_DRIVER', () => {
    expect(() =>
      validate(validConfig({ CACHE_DRIVER: 'memcached' })),
    ).toThrow();
  });

  it('leaves the webhook queue off, and Redis optional, by default', () => {
    expect(() => validate(validConfig())).not.toThrow();
    expect(() =>
      validate(validConfig({ WEBHOOK_QUEUE_ENABLED: 'false' })),
    ).not.toThrow();
  });

  it('requires REDIS_URL when the webhook queue is enabled', () => {
    expect(() =>
      validate(validConfig({ WEBHOOK_QUEUE_ENABLED: 'true' })),
    ).toThrow();
  });

  it('accepts an enabled webhook queue with a REDIS_URL and retry tuning', () => {
    expect(() =>
      validate(
        validConfig({
          WEBHOOK_QUEUE_ENABLED: 'true',
          REDIS_URL: 'redis://localhost:6379',
          WEBHOOK_QUEUE_ATTEMPTS: '8',
          WEBHOOK_QUEUE_BACKOFF_MS: '250',
        }),
      ),
    ).not.toThrow();
  });

  it('keeps WEBHOOK_QUEUE_ENABLED=false as the string "false"', () => {
    const validated = validate(validConfig({ WEBHOOK_QUEUE_ENABLED: 'false' }));

    expect(validated.WEBHOOK_QUEUE_ENABLED).toBe('false');
  });

  it('rejects a non-boolean WEBHOOK_QUEUE_ENABLED', () => {
    expect(() =>
      validate(validConfig({ WEBHOOK_QUEUE_ENABLED: 'yes' })),
    ).toThrow();
  });

  it('rejects a non-integer WEBHOOK_QUEUE_ATTEMPTS', () => {
    expect(() =>
      validate(validConfig({ WEBHOOK_QUEUE_ATTEMPTS: 'many' })),
    ).toThrow();
  });

  it.each(['true', 'false'])('accepts SCHEDULER_ENABLED=%s', (value) => {
    expect(() =>
      validate(validConfig({ SCHEDULER_ENABLED: value })),
    ).not.toThrow();
  });

  it('rejects a non-boolean SCHEDULER_ENABLED', () => {
    expect(() => validate(validConfig({ SCHEDULER_ENABLED: 'off' }))).toThrow();
  });

  it('accepts optional tracing configuration and rejects invalid flags', () => {
    expect(() =>
      validate(validConfig({ OTEL_TRACING_ENABLED: 'true' })),
    ).not.toThrow();
    expect(() =>
      validate(validConfig({ OTEL_TRACING_ENABLED: 'false' })),
    ).not.toThrow();
    expect(() =>
      validate(validConfig({ OTEL_TRACING_ENABLED: 'yes' })),
    ).toThrow();
  });

  it('rejects a missing required field', () => {
    const config = validConfig();
    delete (config as Record<string, unknown>).DATABASE_URL;
    expect(() => validate(config)).toThrow();
  });
});
