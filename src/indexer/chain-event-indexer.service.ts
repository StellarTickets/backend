import { Injectable } from '@nestjs/common';
import { TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChainTicketEvent, StellarService } from '../stellar/stellar.service';

/** Name of the `IndexerCursor` row this indexer advances. */
export const TICKET_EVENTS_CURSOR = 'ticketing-events';

/** Events fetched per poll. */
export const INDEXER_PAGE_SIZE = 100;

/**
 * Applies ticketing-contract events (`TicketIssued`, `TicketCheckedIn`) to the
 * cached ticket state, so the DB keeps up with the chain (#163).
 *
 * Each event is applied in its own DB transaction together with the cursor
 * advance. Two guarantees follow:
 *   - Idempotent: the RPC event id is a primary key in `ProcessedChainEvent`,
 *     so a re-delivered event is skipped and does not change state twice.
 *   - Resumable: the cursor only moves past events whose changes committed,
 *     so a crash mid-page resumes from the last applied event.
 */
@Injectable()
export class ChainEventIndexer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stellar: StellarService,
  ) {}

  /** Polls one page after the stored cursor. Returns how many events changed state. */
  async indexOnce(): Promise<number> {
    const stored = await this.prisma.indexerCursor.findUnique({
      where: { name: TICKET_EVENTS_CURSOR },
    });
    const events = await this.stellar.getTicketEvents(
      stored?.cursor,
      INDEXER_PAGE_SIZE,
    );

    let applied = 0;
    for (const event of events) {
      if (await this.apply(event)) {
        applied++;
      }
    }
    return applied;
  }

  /** Returns false when the event was already applied. */
  private apply(event: ChainTicketEvent): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // `skipDuplicates` turns a repeat into `ON CONFLICT DO NOTHING`, so the
      // transaction stays usable. A caught unique-violation would abort it.
      const { count } = await tx.processedChainEvent.createMany({
        data: [{ id: event.id, ledger: event.ledger, name: event.name }],
        skipDuplicates: true,
      });
      const isNew = count > 0;

      if (isNew && event.name === 'TicketCheckedIn' && event.chainTicketId !== null) {
        await tx.ticket.updateMany({
          where: { chainTicketId: event.chainTicketId },
          data: { status: TicketStatus.USED },
        });
      }

      await tx.indexerCursor.upsert({
        where: { name: TICKET_EVENTS_CURSOR },
        create: { name: TICKET_EVENTS_CURSOR, cursor: event.pagingToken },
        update: { cursor: event.pagingToken },
      });
      return isNew;
    });
  }
}
