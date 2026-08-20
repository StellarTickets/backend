import { ConfigService } from '@nestjs/config';
import { StellarService } from './stellar.service';

const CONFIG: Record<string, string> = {
  SOROBAN_RPC_URL: 'https://soroban-testnet.stellar.org',
  STELLAR_NETWORK: 'TESTNET',
  TICKETING_CONTRACT_ID: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  // Throwaway keypair generated for this test only. It is never funded and
  // never used against a network; the constructor just needs a parseable
  // strkey to build a Keypair.
  PLATFORM_SIGNER_SECRET: 'SCE46EPRLQCNBWZ2YMZDJHR3BRALANZRFU7VL22SL5LK6X7QOATVDEDB',
};

const config = {
  getOrThrow: (k: string) => {
    if (!(k in CONFIG)) throw new Error(`missing ${k}`);
    return CONFIG[k];
  },
  get: (k: string) => CONFIG[k],
} as unknown as ConfigService;

describe('StellarService.decodeStatus', () => {
  const service = new StellarService(config);
  // decodeStatus is private; bracket access keeps the test without widening the
  // service's public surface just to make it testable.
  const decode = (raw: unknown) =>
    (service as unknown as { decodeStatus: (r: unknown) => string }).decodeStatus(
      raw,
    );

  it.each(['Valid', 'Used', 'Revoked', 'Resale'])('decodes %s', (tag) => {
    expect(decode({ tag })).toBe(tag);
  });

  // The decoded value is persisted to the DB status column and gates entry, so
  // an unknown tag must fail closed. Defaulting to 'Valid' would let a
  // contract/SDK version mismatch admit a ticket that is used or revoked
  // on-chain.
  it('throws on an unrecognized tag rather than defaulting to Valid', () => {
    expect(() => decode({ tag: 'SomeFutureStatus' })).toThrow(
      /Unrecognized on-chain ticket status/,
    );
  });

  it('throws on malformed input rather than defaulting to Valid', () => {
    expect(() => decode(undefined)).toThrow(
      /Unrecognized on-chain ticket status/,
    );
    expect(() => decode({})).toThrow(/Unrecognized on-chain ticket status/);
  });
});
