import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";

export const currenciesRouter = Router();
// Any signed-in user can read the list (trade/expense forms need it); only an
// admin can add, edit or remove a currency.
currenciesRouter.use(authRequired);

currenciesRouter.get("/", async (_req, res) => {
  const currencies = await prisma.currency.findMany({
    orderBy: [{ isBase: "desc" }, { code: "asc" }],
  });
  res.json(currencies);
});

const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}$/, "Code must be 2–6 letters (e.g. USD)"),
  symbol: z.string().trim().min(1).max(6),
  decimals: z.coerce.number().int().min(0).max(9),
  rate: z.coerce.number().positive("Rate must be greater than 0").optional(),
});

currenciesRouter.post("/", adminRequired, async (req, res) => {
  const parsed = currencySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid currency" });
  const exists = await prisma.currency.findUnique({ where: { code: parsed.data.code } });
  if (exists) return res.status(409).json({ error: `${parsed.data.code} already exists` });
  const created = await prisma.currency.create({
    data: {
      code: parsed.data.code,
      symbol: parsed.data.symbol,
      decimals: parsed.data.decimals,
      isBase: false,
      rate: parsed.data.rate ?? 1,
      rateUpdatedAt: parsed.data.rate !== undefined ? new Date() : null,
    },
  });
  res.status(201).json(created);
});

currenciesRouter.put("/:id", adminRequired, async (req, res) => {
  // Code can't be edited (records reference it). Symbol / decimals / today's rate can.
  const parsed = currencySchema
    .pick({ symbol: true, decimals: true, rate: true })
    .partial()
    .safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid currency" });
  const existing = await prisma.currency.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Currency not found" });

  const data: Record<string, unknown> = {
    symbol: parsed.data.symbol,
    decimals: parsed.data.decimals,
  };
  if (parsed.data.rate !== undefined && !existing.isBase) {
    data.rate = parsed.data.rate;
    data.rateUpdatedAt = new Date();
  }
  const updated = await prisma.currency.update({ where: { id: req.params.id }, data });
  res.json(updated);
});

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be yyyy-mm-dd");
const todayStr = () => new Date().toISOString().slice(0, 10);

// Bulk "save rates for a date" — the daily update panel, backfillable to any past day.
const ratesSchema = z.object({
  date: dateStr.optional(), // defaults to today
  rates: z
    .array(z.object({ code: z.string().trim().toUpperCase(), rate: z.coerce.number().positive() }))
    .min(1),
});
currenciesRouter.post("/rates", adminRequired, async (req, res) => {
  const parsed = ratesSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Provide { rates: [{ code, rate }], date? }" });
  const date = parsed.data.date ?? todayStr();
  const isCurrentOrFuture = date >= todayStr();
  const now = new Date();

  await prisma.$transaction([
    // History row, one per currency per day — upsert so re-saving the same day edits it.
    ...parsed.data.rates.map((r) =>
      prisma.currencyRate.upsert({
        where: { currencyCode_date: { currencyCode: r.code, date } },
        update: { rate: r.rate },
        create: { currencyCode: r.code, date, rate: r.rate },
      })
    ),
    // Keep Currency.rate as a fast "latest" cache — only advance it when this save
    // is for today (or, if someone pre-loads a future date, that too); a backfill
    // for a past date must never overwrite what's currently the live rate.
    ...(isCurrentOrFuture
      ? parsed.data.rates.map((r) =>
          prisma.currency.updateMany({
            where: { code: r.code, isBase: false },
            data: { rate: r.rate, rateUpdatedAt: now },
          })
        )
      : []),
  ]);

  const currencies = await prisma.currency.findMany({
    orderBy: [{ isBase: "desc" }, { code: "asc" }],
  });
  res.json(currencies);
});

/**
 * Resolve every currency's rate as of one date, for the "Today's rates" panel
 * (when backfilling a past day) and for trade/expense forms (when the record's
 * own date differs from today). Falls back to the most recent rate on or before
 * the requested date; if that currency has no history at all yet, falls back to
 * its live Currency.rate. `exact: false` tells the client it's a fallback so it
 * can show which date the rate actually came from.
 */
currenciesRouter.get("/rates-on", async (req, res) => {
  const parsed = dateStr.safeParse(req.query.date);
  if (!parsed.success) return res.status(400).json({ error: "Provide ?date=yyyy-mm-dd" });
  const date = parsed.data;

  const currencies = await prisma.currency.findMany();
  const resolved = await Promise.all(
    currencies.map(async (c) => {
      if (c.isBase) return { code: c.code, rate: 1, resolvedDate: date, exact: true };
      const historyRow = await prisma.currencyRate.findFirst({
        where: { currencyCode: c.code, date: { lte: date } },
        orderBy: { date: "desc" },
      });
      if (historyRow)
        return {
          code: c.code,
          rate: historyRow.rate,
          resolvedDate: historyRow.date,
          exact: historyRow.date === date,
        };
      return {
        code: c.code,
        rate: c.rate,
        resolvedDate: c.rateUpdatedAt ? c.rateUpdatedAt.toISOString().slice(0, 10) : null,
        exact: false,
      };
    })
  );
  res.json(resolved);
});

currenciesRouter.delete("/:id", adminRequired, async (req, res) => {
  const c = await prisma.currency.findUnique({ where: { id: req.params.id } });
  if (!c) return res.status(404).json({ error: "Currency not found" });
  if (c.isBase)
    return res.status(400).json({ error: "The base currency (AED) can't be deleted" });
  const [inTrades, inExpenses, inInvestors] = await Promise.all([
    prisma.goldTransaction.count({ where: { currencyCode: c.code } }),
    prisma.expense.count({ where: { currencyCode: c.code } }),
    prisma.investor.count({ where: { currencyCode: c.code } }),
  ]);
  const used = inTrades + inExpenses + inInvestors;
  if (used > 0)
    return res
      .status(409)
      .json({ error: `${c.code} is used by ${used} record(s) and can't be deleted` });
  await prisma.currency.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
