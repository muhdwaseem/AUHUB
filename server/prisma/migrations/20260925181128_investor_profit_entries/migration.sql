-- AlterTable
ALTER TABLE "Investor" ADD COLUMN "trackingMode" TEXT NOT NULL DEFAULT 'CAPITAL';
ALTER TABLE "Investor" ADD COLUMN "goldQuantityGrams" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "ProfitEntry" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantityGrams" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfitEntry_investorId_idx" ON "ProfitEntry"("investorId");

-- AddForeignKey
ALTER TABLE "ProfitEntry" ADD CONSTRAINT "ProfitEntry_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
