-- CreateTable
CREATE TABLE "CurrencyRate" (
    "id" TEXT NOT NULL,
    "currencyCode" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CurrencyRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurrencyRate_currencyCode_date_idx" ON "CurrencyRate"("currencyCode", "date");

-- CreateIndex
CREATE UNIQUE INDEX "CurrencyRate_currencyCode_date_key" ON "CurrencyRate"("currencyCode", "date");
