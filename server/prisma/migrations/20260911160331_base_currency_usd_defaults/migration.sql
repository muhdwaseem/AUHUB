-- AlterTable
ALTER TABLE "Expense" ALTER COLUMN "currencyCode" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "GoldTransaction" ALTER COLUMN "currencyCode" SET DEFAULT 'USD';

-- AlterTable
ALTER TABLE "Investor" ALTER COLUMN "currencyCode" SET DEFAULT 'USD';

-- Rebase the reporting currency from AED to USD. Every `rate`/`fxRate` in
-- this system means "units of the base currency per 1 unit of that
-- currency". Switching the base means every one of those numbers has to be
-- re-expressed against USD instead of AED, using the AED-per-USD rate in
-- effect right now as the single conversion pivot — this keeps every
-- historical trade/expense/investor record showing the same real value,
-- just denominated in USD instead of AED.
DO $$
DECLARE
  pivot double precision; -- AED per 1 USD, at migration time
BEGIN
  SELECT rate INTO pivot FROM "Currency" WHERE code = 'USD';
  IF pivot IS NULL OR pivot = 0 THEN
    RAISE EXCEPTION 'USD currency row missing or has a zero rate — aborting base currency migration';
  END IF;

  -- Every other currency's rate: was "AED per unit", becomes "USD per unit".
  UPDATE "Currency" SET rate = rate / pivot WHERE code <> 'USD';
  -- USD becomes the base itself.
  UPDATE "Currency" SET rate = 1, "isBase" = true WHERE code = 'USD';
  UPDATE "Currency" SET "isBase" = false WHERE code = 'AED';
  -- Also fixes a bad manual entry that left THB showing 9 decimal places.
  UPDATE "Currency" SET decimals = 2 WHERE code = 'THB';

  -- Every historical trade/expense/investor record's own fxRate: same
  -- rebase, except a record already priced in USD, which must be exactly 1
  -- now that USD is the base (its old fxRate was the historical AED/USD
  -- rate on its own save date, not something this single pivot can rescale
  -- correctly, so it's forced to the only value a base-currency record can
  -- ever hold).
  UPDATE "GoldTransaction"
    SET "fxRate" = CASE WHEN "currencyCode" = 'USD' THEN 1 ELSE "fxRate" / pivot END;
  UPDATE "Expense"
    SET "fxRate" = CASE WHEN "currencyCode" = 'USD' THEN 1 ELSE "fxRate" / pivot END;
  UPDATE "Investor"
    SET "fxRate" = CASE WHEN "currencyCode" = 'USD' THEN 1 ELSE "fxRate" / pivot END;
  -- Per-date rate history (Currencies admin page), same treatment.
  UPDATE "CurrencyRate"
    SET rate = CASE WHEN "currencyCode" = 'USD' THEN 1 ELSE rate / pivot END;

  IF (SELECT COUNT(*) FROM "Currency" WHERE "isBase" = true) <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one base currency after migration, found %',
      (SELECT COUNT(*) FROM "Currency" WHERE "isBase" = true);
  END IF;
END $$;
