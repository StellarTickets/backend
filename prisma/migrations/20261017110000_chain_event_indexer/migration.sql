-- CreateTable
CREATE TABLE "IndexerCursor" (
    "name" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ProcessedChainEvent" (
    "id" TEXT NOT NULL,
    "ledger" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedChainEvent_pkey" PRIMARY KEY ("id")
);
