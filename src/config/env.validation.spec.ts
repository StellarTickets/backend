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

  it('rejects a missing required field', () => {
    const config = validConfig();
    delete (config as Record<string, unknown>).DATABASE_URL;
    expect(() => validate(config)).toThrow();
  });
});
