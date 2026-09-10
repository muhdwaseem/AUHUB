-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'AED',
ADD COLUMN     "fxRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "GoldTransaction" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'AED',
ADD COLUMN     "fxRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Investor" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'AED',
ADD COLUMN     "fxRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Currency" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Currency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");
