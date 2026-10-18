import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FeatureFlagsService } from '../config/feature-flags.service';
import { ChainEventIndexer } from './chain-event-indexer.service';

export const CHAIN_EVENT_INDEXER_JOB_NAME = 'chain-event-indexer';

/**
 * Polls the ticketing contract for events every 30 seconds. Does nothing
 * unless `FEATURE_INDEXER=true`, so the cron can stay registered in every
 * environment.
 */
@Injectable()
export class ChainEventIndexerJob {
  private readonly logger = new Logger(ChainEventIndexerJob.name);

  constructor(
    private readonly indexer: ChainEventIndexer,
    private readonly flags: FeatureFlagsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { name: CHAIN_EVENT_INDEXER_JOB_NAME })
  async run(): Promise<void> {
    if (!this.flags.isEnabled('indexer')) {
      return;
    }
    try {
      const applied = await this.indexer.indexOnce();
      if (applied > 0) {
        this.logger.log(`Applied ${applied} ticket event(s) from chain`);
      }
    } catch (err) {
      this.logger.error(
        `Chain event indexing failed: ${(err as Error).message}`,
      );
    }
  }
}
