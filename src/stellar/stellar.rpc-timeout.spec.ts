import { ConfigService } from '@nestjs/config';
import { Keypair } from '@stellar/stellar-sdk';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { TEST_CONTRACT_ID } from '../../test/helpers/stellar-harness';
import { StellarService } from './stellar.service';

describe('StellarService RPC timeout', () => {
  it('times out a stalled HTTP response using the configured milliseconds', async () => {
    let method: string | undefined;
    const http = createServer((request, response) => {
      method = request.method;
      const fallback = setTimeout(() => response.writeHead(503).end(), 3_000);
      response.once('close', () => clearTimeout(fallback));
    });
    await new Promise<void>((resolve, reject) => {
      http.once('error', reject);
      http.listen(0, '127.0.0.1', resolve);
    });

    try {
      const { port } = http.address() as AddressInfo;
      const service = new StellarService(
        new ConfigService({
          SOROBAN_RPC_URL: `http://127.0.0.1:${port}`,
          SOROBAN_RPC_TIMEOUT_MS: 500,
          STELLAR_NETWORK: 'testnet',
          TICKETING_CONTRACT_ID: TEST_CONTRACT_ID,
          PLATFORM_SIGNER_SECRET: Keypair.random().secret(),
        }),
      );

      const { up, latencyMs } = await service.pingRpc();
      expect(method).toBe('POST');
      expect(up).toBe(false);
      expect(latencyMs).toBeLessThan(2_500);
    } finally {
      await new Promise<void>((resolve) => {
        http.close(() => resolve());
        http.closeAllConnections();
      });
    }
  });
});
