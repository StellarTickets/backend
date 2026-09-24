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

  it('rejects a missing required field', () => {
    const config = validConfig();
    delete (config as Record<string, unknown>).DATABASE_URL;
    expect(() => validate(config)).toThrow();
  });

  describe('API_PREFIX (#250)', () => {
    it.each(['api', '/api/v1/', 'v1.0', ''])('accepts %p', (API_PREFIX) => {
      expect(() => validate(validConfig({ API_PREFIX }))).not.toThrow();
    });

    it.each(['api v1', 'api//v1', 'api?x=1', '../api', 'api/./v1'])(
      'rejects %p',
      (API_PREFIX) => {
        expect(() => validate(validConfig({ API_PREFIX }))).toThrow(
          /API_PREFIX/,
        );
      },
    );
  });

  describe('JWT_SECRET strength (#251)', () => {
    const strongSecret = 'k3Jq9vX2pL7mN4bR8tY1wZ6cF0hG5dSa';

    it('accepts a random secret in production', () => {
      expect(() =>
        validate(
          validConfig({ NODE_ENV: 'production', JWT_SECRET: strongSecret }),
        ),
      ).not.toThrow();
    });

    it('rejects a short secret in production', () => {
      expect(() =>
        validate(validConfig({ NODE_ENV: 'production', JWT_SECRET: 'short' })),
      ).toThrow();
    });

    it.each([
      'changeme-changeme-changeme-changeme',
      'your-jwt-secret-goes-here-1234567890',
      'CHANGE_ME_TO_A_RANDOM_32_CHARACTER_VALUE',
      'super-secret-key-for-example-app-2026',
    ])('rejects the placeholder %p in production', (JWT_SECRET) => {
      expect(() =>
        validate(validConfig({ NODE_ENV: 'production', JWT_SECRET })),
      ).toThrow(/placeholder/);
    });

    it('rejects a low-variety secret in production', () => {
      expect(() =>
        validate(
          validConfig({ NODE_ENV: 'production', JWT_SECRET: 'ab'.repeat(20) }),
        ),
      ).toThrow(/distinct characters/);
    });

    it('allows placeholder-style secrets outside production', () => {
      expect(() =>
        validate(
          validConfig({
            NODE_ENV: 'development',
            JWT_SECRET: 'changeme-changeme-changeme-changeme',
          }),
        ),
      ).not.toThrow();
    });
  });

  describe('SOROBAN_RPC_URL / STELLAR_NETWORK pairing (#252)', () => {
    it.each([
      ['https://soroban-testnet.stellar.org', 'testnet'],
      ['https://rpc-futurenet.stellar.org', 'futurenet'],
      ['https://mainnet.sorobanrpc.com', 'mainnet'],
      ['http://localhost:8000/soroban/rpc', 'testnet'],
      ['https://rpc.internal.example.net', 'mainnet'],
    ])('accepts %s on %s', (SOROBAN_RPC_URL, STELLAR_NETWORK) => {
      expect(() =>
        validate(validConfig({ SOROBAN_RPC_URL, STELLAR_NETWORK })),
      ).not.toThrow();
    });

    it.each([
      ['https://soroban-testnet.stellar.org', 'mainnet'],
      ['https://soroban-testnet.stellar.org', 'futurenet'],
      ['https://rpc-futurenet.stellar.org', 'testnet'],
      ['https://mainnet.sorobanrpc.com', 'testnet'],
    ])('rejects %s on %s', (SOROBAN_RPC_URL, STELLAR_NETWORK) => {
      expect(() =>
        validate(validConfig({ SOROBAN_RPC_URL, STELLAR_NETWORK })),
      ).toThrow(/wrong network passphrase/);
    });

    it('rejects an RPC URL that is not http(s)', () => {
      expect(() =>
        validate(validConfig({ SOROBAN_RPC_URL: 'ftp://rpc.example.com' })),
      ).toThrow(/http or https/);
    });

    it('rejects an RPC URL that does not parse', () => {
      expect(() =>
        validate(validConfig({ SOROBAN_RPC_URL: 'not a url' })),
      ).toThrow(/not a valid URL/);
    });
  });

  describe('SECRETS_PROVIDER (#253)', () => {
    it('defaults to env and requires JWT_SECRET', () => {
      const config = validConfig();
      delete (config as Record<string, unknown>).JWT_SECRET;
      expect(() => validate(config)).toThrow(/JWT_SECRET/);
    });

    it('with file, requires JWT_SECRET_FILE instead of JWT_SECRET', () => {
      const config = validConfig({ SECRETS_PROVIDER: 'file' });
      delete (config as Record<string, unknown>).JWT_SECRET;
      expect(() => validate(config)).toThrow(/JWT_SECRET_FILE/);
      expect(() =>
        validate({ ...config, JWT_SECRET_FILE: '/run/secrets/jwt' }),
      ).not.toThrow();
    });

    it('with file, ignores a leftover empty JWT_SECRET', () => {
      expect(() =>
        validate(
          validConfig({
            NODE_ENV: 'production',
            SECRETS_PROVIDER: 'file',
            JWT_SECRET: '',
            JWT_SECRET_FILE: '/run/secrets/jwt',
          }),
        ),
      ).not.toThrow();
    });

    it('with custom, requires neither', () => {
      const config = validConfig({ SECRETS_PROVIDER: 'custom' });
      delete (config as Record<string, unknown>).JWT_SECRET;
      expect(() => validate(config)).not.toThrow();
    });

    it('rejects an unknown provider', () => {
      expect(() =>
        validate(validConfig({ SECRETS_PROVIDER: 'vault' })),
      ).toThrow();
    });
  });
});
