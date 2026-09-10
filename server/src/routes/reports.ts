import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";
import { buildReport, investorSplit } from "../lib/accounting.js";

export const reportsRouter = Router();
reportsRouter.use(authRequired, adminRequired);

async function loadData(from?: string, to?: string) {
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasFilter = from || to;

  const [txns, expenses, investors] = await Promise.all([
    prisma.goldTransaction.findMany({
      where: hasFilter ? { date: dateFilter } : undefined,
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: hasFilter ? { date: dateFilter } : undefined,
      include: { category: true, investor: true },
      orderBy: { date: "asc" },
    }),
    prisma.investor.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  return { txns, expenses, investors };
}

// Full report: overall + daily + investor split
reportsRouter.get("/summary", async (req, res) => {
  const { from, to } = req.query as Record<string, string>;
  const { txns, expenses, investors } = await loadData(from, to);

  // Every amount is stored in its record's own currency; fxRate brings it to the
  // base currency, which is the only space the accounting engine works in.
  const report = buildReport(
    txns.map((t) => ({
      type: t.type,
      date: t.date,
      quality: t.quality,
      quantityGrams: t.quantityGrams,
      ratePerGram: t.ratePerGram * (t.fxRate ?? 1),
      totalAmount: t.totalAmount * (t.fxRate ?? 1),
    })),
    expenses.map((e) => ({
      amount: e.amount * (e.fxRate ?? 1),
      date: e.date,
      categoryName: e.category.name,
      investorId: e.investorId,
      chargedToInvestor: e.chargedToInvestor,
    }))
  );

  const split = investorSplit(report.overall, investors);
  const dailySplit = report.daily.map((day) => ({
    date: day.date,
    rows: investorSplit(day, investors),
  }));

  // expense totals per header
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    byCategory.set(e.category.name, (byCategory.get(e.category.name) ?? 0) + e.amount);
  }

  // expense totals per investor (tagged), split into charged vs just-tagged
  const byInvestor = new Map<string, { charged: number; tagged: number }>();
  for (const e of expenses) {
    if (!e.investorId) continue;
    const name = e.investor?.name ?? "Unknown";
    const cur = byInvestor.get(name) ?? { charged: 0, tagged: 0 };
    if (e.chargedToInvestor) cur.charged += e.amount;
    else cur.tagged += e.amount;
    byInvestor.set(name, cur);
  }

  res.json({
    ...report,
    investorSplit: split,
    dailyInvestorSplit: dailySplit,
    expensesByCategory: [...byCategory.entries()]
      .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
      .sort((a, b) => b.amount - a.amount),
    expensesByInvestor: [...byInvestor.entries()]
      .map(([name, v]) => ({
        name,
        charged: Math.round(v.charged * 100) / 100,
        tagged: Math.round(v.tagged * 100) / 100,
      }))
      .sort((a, b) => b.charged + b.tagged - (a.charged + a.tagged)),
    totalActiveShare: investors
      .filter((i) => i.status === "ACTIVE")
      .reduce((s, i) => s + i.sharePercentage, 0),
    counts: {
      investors: investors.length,
      transactions: txns.length,
      expenses: expenses.length,
    },
  });
});
