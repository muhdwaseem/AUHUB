import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";

export const expenseCategoriesRouter = Router();
expenseCategoriesRouter.use(authRequired, adminRequired);

expenseCategoriesRouter.get("/", async (_req, res) => {
  const categories = await prisma.expenseCategory.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: { _count: { select: { expenses: true } } },
  });
  res.json(
    categories.map((c) => ({
      id: c.id,
      name: c.name,
      isDefault: c.isDefault,
      expenseCount: c._count.expenses,
    }))
  );
});

const nameSchema = z.object({ name: z.string().min(1, "Name is required").max(60) });

expenseCategoriesRouter.post("/", async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const name = parsed.data.name.trim();
  const existing = await prisma.expenseCategory.findUnique({ where: { name } });
  if (existing) return res.status(409).json({ error: "That header already exists" });
  const cat = await prisma.expenseCategory.create({ data: { name } });
  res.status(201).json(cat);
});

expenseCategoriesRouter.put("/:id", async (req, res) => {
  const parsed = nameSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message });
  const cat = await prisma.expenseCategory.findUnique({ where: { id: req.params.id } });
  if (!cat) return res.status(404).json({ error: "Header not found" });
  const updated = await prisma.expenseCategory.update({
    where: { id: req.params.id },
    data: { name: parsed.data.name.trim() },
  });
  res.json(updated);
});

expenseCategoriesRouter.delete("/:id", async (req, res) => {
  const cat = await prisma.expenseCategory.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { expenses: true } } },
  });
  if (!cat) return res.status(404).json({ error: "Header not found" });
  if (cat._count.expenses > 0)
    return res.status(409).json({
      error: `Cannot delete "${cat.name}" — ${cat._count.expenses} expense(s) use it. Reassign or delete those first.`,
    });
  await prisma.expenseCategory.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
