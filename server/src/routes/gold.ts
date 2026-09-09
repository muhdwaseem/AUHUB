import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";

export const goldRouter = Router();
goldRouter.use(authRequired, adminRequired);

const txnSchema = z.object({
  type: z.enum(["BUY", "SELL"]),
  date: z.coerce.date(),
  quality: z.string().min(1, "Quality / purity is required"),
  quantityGrams: z.coerce.number().positive("Quantity must be greater than 0"),
  ratePerGram: z.coerce.number().positive("Rate must be greater than 0"),
  counterparty: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

goldRouter.get("/", async (req, res) => {
  const { from, to, type } = req.query as Record<string, string>;
  const where: any = {};
  if (from || to) where.date = {};
  if (from) where.date.gte = new Date(from);
  if (to) where.date.lte = new Date(to);
  if (type) where.type = type;
  const txns = await prisma.goldTransaction.findMany({ where, orderBy: { date: "desc" } });
  res.json({ transactions: txns });
});

goldRouter.post("/", async (req, res) => {
  const parsed = txnSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  const d = parsed.data;
  const txn = await prisma.goldTransaction.create({
    data: {
      type: d.type,
      date: d.date,
      quality: d.quality.trim(),
      quantityGrams: d.quantityGrams,
      ratePerGram: d.ratePerGram,
      totalAmount: Math.round(d.quantityGrams * d.ratePerGram * 100) / 100,
      counterparty: d.counterparty || null,
      notes: d.notes || null,
    },
  });
  res.status(201).json(txn);
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
  const txn = await prisma.goldTransaction.update({
    where: { id: req.params.id },
    data: {
      type: d.type ?? undefined,
      date: d.date ?? undefined,
      quality: d.quality?.trim() ?? undefined,
      quantityGrams,
      ratePerGram,
      totalAmount: Math.round(quantityGrams * ratePerGram * 100) / 100,
      counterparty: d.counterparty === undefined ? undefined : d.counterparty || null,
      notes: d.notes === undefined ? undefined : d.notes || null,
    },
  });
  res.json(txn);
});

goldRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.goldTransaction.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Transaction not found" });
  await prisma.goldTransaction.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
