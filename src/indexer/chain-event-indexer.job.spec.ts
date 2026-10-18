import 'reflect-metadata';

jest.mock('../stellar/stellar.service', () => ({ StellarService: jest.fn() }));

import { ChainEventIndexerJob } from './chain-event-indexer.job';
import type { ChainEventIndexer } from './chain-event-indexer.service';
import type { FeatureFlagsService } from '../config/feature-flags.service';

function setup(enabled: boolean) {
  const indexer = { indexOnce: jest.fn().mockResolvedValue(0) };
  const flags = { isEnabled: jest.fn().mockReturnValue(enabled) };
  const job = new ChainEventIndexerJob(
    indexer as unknown as ChainEventIndexer,
    flags as unknown as FeatureFlagsService,
  );
  return { job, indexer, flags };
}

describe('ChainEventIndexerJob', () => {
  it('does nothing while FEATURE_INDEXER is off', async () => {
    const { job, indexer, flags } = setup(false);

    await job.run();

    expect(flags.isEnabled).toHaveBeenCalledWith('indexer');
    expect(indexer.indexOnce).not.toHaveBeenCalled();
  });

  it('polls the chain when FEATURE_INDEXER is on', async () => {
    const { job, indexer } = setup(true);

    await job.run();

    expect(indexer.indexOnce).toHaveBeenCalledTimes(1);
  });

  it('survives a failed poll so the next tick can retry', async () => {
    const { job, indexer } = setup(true);
    indexer.indexOnce.mockRejectedValueOnce(new Error('RPC unavailable'));

    await expect(job.run()).resolves.toBeUndefined();
  });
});
