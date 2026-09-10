-- CreateTable
CREATE TABLE "ProfitPartner" (
    "id" TEXT NOT NULL,
    "investorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfitPartner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfitPartner_investorId_idx" ON "ProfitPartner"("investorId");

-- AddForeignKey
ALTER TABLE "ProfitPartner" ADD CONSTRAINT "ProfitPartner_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
