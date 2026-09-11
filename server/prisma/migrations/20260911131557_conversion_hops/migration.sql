-- CreateTable
CREATE TABLE "ConversionHop" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT,
    "expenseId" TEXT,
    "order" INTEGER NOT NULL,
    "fromCurrency" TEXT NOT NULL,
    "fromAmount" DOUBLE PRECISION NOT NULL,
    "toCurrency" TEXT NOT NULL,
    "toAmount" DOUBLE PRECISION NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversionHop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversionHop_transactionId_idx" ON "ConversionHop"("transactionId");

-- CreateIndex
CREATE INDEX "ConversionHop_expenseId_idx" ON "ConversionHop"("expenseId");

-- AddForeignKey
ALTER TABLE "ConversionHop" ADD CONSTRAINT "ConversionHop_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "GoldTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversionHop" ADD CONSTRAINT "ConversionHop_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed USDT as a currency (a stablecoin hop target) with a starting rate near
-- its real-world USD peg. The admin corrects it via the rates panel like any
-- other currency; ON CONFLICT guards a fresh install where the seed script
-- already creates it.
INSERT INTO "Currency" ("id", "code", "symbol", "decimals", "isBase", "rate", "rateUpdatedAt", "createdAt")
VALUES ('usdt_seed_1', 'USDT', 'USDT', 2, false, 3.6725, NULL, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
