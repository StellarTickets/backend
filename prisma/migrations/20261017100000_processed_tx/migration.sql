-- CreateTable
CREATE TABLE "ProcessedTx" (
    "txHash" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedTx_pkey" PRIMARY KEY ("txHash")
);
