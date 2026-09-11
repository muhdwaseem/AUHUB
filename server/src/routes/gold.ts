import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";

export const goldRouter = Router();
goldRouter.use(authRequired, adminRequired);

/** One leg of a multi-step conversion (e.g. THB -> USDT -> AED). `rate` is
 *  always derived server-side from the two amounts, never trusted from the client. */
const hopSchema = z.object({
  order: z.coerce.number().int().min(1),
  fromCurrency: z.string().trim().toUpperCase().min(1).max(10),
  fromAmount: z.coerce.number().positive(),
  toCurrency: z.string().trim().toUpperCase().min(1).max(10),
  toAmount: z.coerce.number().positive(),
  date: z.coerce.date(),
  notes: z.string().optional().or(z.literal("")),
});

const txnSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  teamId: z.string().trim().min(1).optional(),
  date: z.coerce.date(),
  quality: z.string().min(1, "Quality / purity is required"),
  quantityGrams: z.coerce.number().positive("Quantity must be greater than 0"),
  ratePerGram: z.coerce.number().positive("Rate must be greater than 0"),
  currencyCode: z.string().trim().toUpperCase().optional(),
  fxRate: z.coerce.number().positive("FX rate must be greater than 0").optional(),
  counterparty: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  /** Optional conversion trail — purely a paper trail, doesn't change the
   *  accounting; replace-all on save, same as an investor's profit partners. */
  hops: z.array(hopSchema).optional(),
});

/** Resolve a currency code to its stored row + a sane fxRate (base is always 1). */
async function resolveCurrency(code: string, fxRate?: number) {
  const cur = await prisma.currency.findUnique({ where: { code } });
  if (!cur) return null;
  return { code: cur.code, fxRate: cur.isBase ? 1 : (fxRate ?? cur.rate) };
}

const hopData = (hops: z.infer<typeof hopSchema>[] | undefined) =>
  (hops ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((h, idx) => ({
      order: idx + 1,
      fromCurrency: h.fromCurrency,
      fromAmount: h.fromAmount,
      toCurrency: h.toCurrency,
      toAmount: h.toAmount,
      rate: Math.round((h.toAmount / h.fromAmount) * 1e9) / 1e9,
      date: h.date,
      notes: h.notes || null,
    }));

const withHops = { conversionHops: { orderBy: { order: "asc" as const } } };

/** Prisma's relation is named `conversionHops` — the client expects `hops`.
 *  Never send the raw record; every response goes through this. */
function serialize(t: any) {
  const { conversionHops, ...rest } = t;
  return { ...rest, hops: conversionHops ?? [] };
}

goldRouter.get("/", async (req, res) => {
  const { from, to, type, teamId } = req.query as Record<string, string>;
  const where: any = {};
  if (teamId) where.teamId = teamId;
  if (from || to) where.date = {};
  if (from) where.date.gte = new Date(from);
  if (to) where.date.lte = new Date(to);
  if (type) where.type = type;
  const txns = await prisma.goldTransaction.findMany({
    where,
    orderBy: { date: "desc" },
    include: withHops,
  });
  res.json({ transactions: txns.map(serialize) });
});

goldRouter.post("/", async (req, res) => {
  const parsed = txnSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  const d = parsed.data;
  if (!d.teamId) return res.status(400).json({ error: "A team is required" });
  const team = await prisma.team.findUnique({ where: { id: d.teamId } });
  if (!team) return res.status(400).json({ error: "Selected team not found" });
  const cur = await resolveCurrency(d.currencyCode ?? "AED", d.fxRate);
  if (!cur) return res.status(400).json({ error: `Unknown currency "${d.currencyCode}"` });
  const txn = await prisma.goldTransaction.create({
    data: {
      type: d.type,
      teamId: d.teamId,
      date: d.date,
      quality: d.quality.trim(),
      quantityGrams: d.quantityGrams,
      ratePerGram: d.ratePerGram,
      totalAmount: Math.round(d.quantityGrams * d.ratePerGram * 100) / 100,
      currencyCode: cur.code,
      fxRate: cur.fxRate,
      counterparty: d.counterparty || null,
      notes: d.notes || null,
      conversionHops: { create: hopData(d.hops) },
    },
    include: withHops,
  });
  res.status(201).json(serialize(txn));
});

goldRouter.put("/:id", async (req, res) => {
  const parsed = txnSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  const existing = await prisma.goldTransaction.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  const d = parsed.data;
  const quantityGrams = d.quantityGrams ?? existing.quantityGrams;
  const ratePerGram = d.ratePerGram ?? existing.ratePerGram;
  let currencyCode: string | undefined;
  let fxRate: number | undefined;
  if (d.currencyCode !== undefined || d.fxRate !== undefined) {
    const cur = await resolveCurrency(
      d.currencyCode ?? existing.currencyCode,
      d.fxRate ?? existing.fxRate
    );
    if (!cur) return res.status(400).json({ error: `Unknown currency "${d.currencyCode}"` });
    currencyCode = cur.code;
    fxRate = cur.fxRate;
  }
  const txn = await prisma.goldTransaction.update({
    where: { id: req.params.id },
    data: {
      type: d.type ?? undefined,
      date: d.date ?? undefined,
      quality: d.quality?.trim() ?? undefined,
      quantityGrams,
      ratePerGram,
      totalAmount: Math.round(quantityGrams * ratePerGram * 100) / 100,
      currencyCode,
      fxRate,
      counterparty: d.counterparty === undefined ? undefined : d.counterparty || null,
      notes: d.notes === undefined ? undefined : d.notes || null,
      // Replace-all: only touch hops when the client sends the array.
      ...(d.hops !== undefined
        ? { conversionHops: { deleteMany: {}, create: hopData(d.hops) } }
        : {}),
    },
    include: withHops,
  });
  res.json(serialize(txn));
});

goldRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.goldTransaction.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  await prisma.goldTransaction.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
