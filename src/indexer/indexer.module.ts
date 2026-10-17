import { Module } from '@nestjs/common';
import { StellarModule } from '../stellar/stellar.module';
import { ChainEventIndexer } from './chain-event-indexer.service';

@Module({
  imports: [StellarModule],
  providers: [ChainEventIndexer],
  exports: [ChainEventIndexer],
})
export class IndexerModule {}
