import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";
import { upload, putAttachment, deleteAttachment } from "../lib/upload.js";

export const expensesRouter = Router();
expensesRouter.use(authRequired, adminRequired);

// multipart sends everything as strings — normalise the two new optional fields
const boolish = z.preprocess(
  (v) => v === true || v === "true" || v === "1" || v === "on",
  z.boolean()
);
const optionalId = z.preprocess(
  (v) => (v === "" || v === "none" || v === undefined || v === null ? null : v),
  z.string().nullable()
);

const expenseSchema = z.object({
  categoryId: z.string().min(1, "Choose an expense header"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  currencyCode: z.string().trim().toUpperCase().optional(),
  fxRate: z.coerce.number().positive("FX rate must be greater than 0").optional(),
  date: z.coerce.date(),
  description: z.string().optional().or(z.literal("")),
  investorId: optionalId.optional(),
  chargedToInvestor: boolish.optional(),
});

/** base = amount * fxRate; the base currency is always fxRate 1. */
async function resolveCurrency(code: string, fxRate: number) {
  const cur = await prisma.currency.findUnique({ where: { code } });
  if (!cur) return null;
  return { code: cur.code, fxRate: cur.isBase ? 1 : fxRate };
}

function serialize(e: any) {
  return {
    id: e.id,
    categoryId: e.categoryId,
    categoryName: e.category?.name,
    amount: e.amount,
    currencyCode: e.currencyCode ?? "AED",
    fxRate: e.fxRate ?? 1,
    date: e.date,
    description: e.description,
    createdAt: e.createdAt,
    investorId: e.investorId ?? null,
    investorName: e.investor?.name ?? null,
    chargedToInvestor: !!e.chargedToInvestor,
    attachments: (e.attachments ?? []).map((a: any) => ({
      id: a.id,
      originalName: a.originalName,
      mimeType: a.mimeType,
      size: a.size,
      url: `/api/files/${a.id}`,
    })),
  };
}

/** Guard: charged-to-investor requires an investor. Returns an error string or null. */
async function validateInvestorLink(
  investorId: string | null | undefined,
  charged: boolean | undefined
): Promise<string | null> {
  if (charged && !investorId)
    return "Select an investor to charge this expense to, or turn off 'charge to investor'.";
  if (investorId) {
    const inv = await prisma.investor.findUnique({ where: { id: investorId } });
    if (!inv) return "Selected investor not found";
  }
  return null;
}

// List (optionally filter by date range / category)
expensesRouter.get("/", async (req, res) => {
  const { from, to, categoryId, investorId } = req.query as Record<string, string>;
  const where: any = {};
  if (from || to) where.date = {};
  if (from) where.date.gte = new Date(from);
  if (to) where.date.lte = new Date(to);
  if (categoryId) where.categoryId = categoryId;
  if (investorId) where.investorId = investorId;

  const expenses = await prisma.expense.findMany({
    where,
    include: { category: true, attachments: true, investor: true },
    orderBy: { date: "desc" },
  });
  // Total is in the base currency — convert each row by its fxRate first.
  const total = expenses.reduce((s, e) => s + e.amount * (e.fxRate ?? 1), 0);
  res.json({ expenses: expenses.map(serialize), total });
});

// Create with optional file attachments (multipart/form-data, field name "files")
expensesRouter.post("/", upload.array("files", 10), async (req, res) => {
  const parsed = expenseSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  const cat = await prisma.expenseCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!cat) return res.status(400).json({ error: "Expense header not found" });

  const linkErr = await validateInvestorLink(
    parsed.data.investorId,
    parsed.data.chargedToInvestor
  );
  if (linkErr) return res.status(400).json({ error: linkErr });

  const cur = await resolveCurrency(parsed.data.currencyCode ?? "AED", parsed.data.fxRate ?? 1);
  if (!cur) return res.status(400).json({ error: `Unknown currency "${parsed.data.currencyCode}"` });

  const files = (req.files as Express.Multer.File[]) ?? [];
  const stored = await Promise.all(files.map(putAttachment));
  const expense = await prisma.expense.create({
    data: {
      categoryId: parsed.data.categoryId,
      amount: parsed.data.amount,
      currencyCode: cur.code,
      fxRate: cur.fxRate,
      date: parsed.data.date,
      description: parsed.data.description || null,
      investorId: parsed.data.investorId ?? null,
      chargedToInvestor: !!parsed.data.chargedToInvestor && !!parsed.data.investorId,
      attachments: {
        create: stored.map((s) => ({
          blobUrl: s.blobUrl,
          originalName: s.originalName,
          mimeType: s.mimeType,
          size: s.size,
        })),
      },
    },
    include: { category: true, attachments: true, investor: true },
  });
  res.status(201).json(serialize(expense));
});

// Update fields (not attachments)
expensesRouter.put("/:id", async (req, res) => {
  const parsed = expenseSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  const existing = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Expense not found" });
  const d = parsed.data;

  const nextInvestorId =
    d.investorId === undefined ? existing.investorId : d.investorId;
  const nextCharged =
    d.chargedToInvestor === undefined
      ? existing.chargedToInvestor
      : d.chargedToInvestor;
  const linkErr = await validateInvestorLink(nextInvestorId, nextCharged);
  if (linkErr) return res.status(400).json({ error: linkErr });

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

  const expense = await prisma.expense.update({
    where: { id: req.params.id },
    data: {
      categoryId: d.categoryId ?? undefined,
      amount: d.amount ?? undefined,
      currencyCode,
      fxRate,
      date: d.date ?? undefined,
      description: d.description === undefined ? undefined : d.description || null,
      investorId: d.investorId === undefined ? undefined : d.investorId,
      chargedToInvestor:
        d.chargedToInvestor === undefined
          ? undefined
          : !!d.chargedToInvestor && !!nextInvestorId,
    },
    include: { category: true, attachments: true, investor: true },
  });
  res.json(serialize(expense));
});

// Add attachments to an existing expense
expensesRouter.post("/:id/attachments", upload.array("files", 10), async (req, res) => {
  const expense = await prisma.expense.findUnique({ where: { id: req.params.id } });
  if (!expense) return res.status(404).json({ error: "Expense not found" });
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) return res.status(400).json({ error: "No files uploaded" });
  const stored = await Promise.all(files.map(putAttachment));
  await prisma.expenseAttachment.createMany({
    data: stored.map((s) => ({
      expenseId: expense.id,
      blobUrl: s.blobUrl,
      originalName: s.originalName,
      mimeType: s.mimeType,
      size: s.size,
    })),
  });
  const updated = await prisma.expense.findUnique({
    where: { id: expense.id },
    include: { category: true, attachments: true, investor: true },
  });
  res.status(201).json(serialize(updated));
});

// Delete one attachment
expensesRouter.delete("/:id/attachments/:attId", async (req, res) => {
  const att = await prisma.expenseAttachment.findUnique({ where: { id: req.params.attId } });
  if (!att || att.expenseId !== req.params.id)
    return res.status(404).json({ error: "Attachment not found" });
  await prisma.expenseAttachment.delete({ where: { id: att.id } });
  await deleteAttachment(att.blobUrl);
  res.json({ ok: true });
});

// Delete expense (and its files)
expensesRouter.delete("/:id", async (req, res) => {
  const expense = await prisma.expense.findUnique({
    where: { id: req.params.id },
    include: { attachments: true },
  });
  if (!expense) return res.status(404).json({ error: "Expense not found" });
  await prisma.expense.delete({ where: { id: req.params.id } });
  await Promise.all(expense.attachments.map((a) => deleteAttachment(a.blobUrl)));
  res.json({ ok: true });
});
