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
  decimals: z.coerce.number().int().min(0).max(4),
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

// Bulk "save today's rates" — one call for the daily update panel.
const ratesSchema = z.object({
  rates: z
    .array(z.object({ code: z.string().trim().toUpperCase(), rate: z.coerce.number().positive() }))
    .min(1),
});
currenciesRouter.post("/rates", adminRequired, async (req, res) => {
  const parsed = ratesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Provide { rates: [{ code, rate }] }" });
  const now = new Date();
  await prisma.$transaction(
    parsed.data.rates.map((r) =>
      prisma.currency.updateMany({
        where: { code: r.code, isBase: false },
        data: { rate: r.rate, rateUpdatedAt: now },
      })
    )
  );
  const currencies = await prisma.currency.findMany({
    orderBy: [{ isBase: "desc" }, { code: "asc" }],
  });
  res.json(currencies);
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
