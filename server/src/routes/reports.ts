import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";
import { buildReport, investorSplit, type InvestorInput } from "../lib/accounting.js";

export const reportsRouter = Router();
reportsRouter.use(authRequired, adminRequired);

/** Load one team's raw rows (or the whole book if teamId is omitted). */
async function loadData(teamId?: string, from?: string, to?: string) {
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasDate = from || to;

  const txnWhere: any = {};
  const expWhere: any = {};
  if (teamId) {
    txnWhere.teamId = teamId;
    expWhere.teamId = teamId;
  }
  if (hasDate) {
    txnWhere.date = dateFilter;
    expWhere.date = dateFilter;
  }

  const [txns, expenses, investors] = await Promise.all([
    prisma.goldTransaction.findMany({ where: txnWhere, orderBy: { date: "asc" } }),
    prisma.expense.findMany({
      where: expWhere,
      include: { category: true, investor: true },
      orderBy: { date: "asc" },
    }),
    prisma.investor.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: "asc" },
      include: { team: true, partners: { orderBy: { createdAt: "asc" } } },
    }),
  ]);
  return { txns, expenses, investors };
}

/** Shape the DB investor rows for the accounting engine, resolving each
 *  member's effective company cut % (their override, else their team's default). */
function toInvestorInputs(investors: any[]): InvestorInput[] {
  return investors.map((i) => ({
    id: i.id,
    name: i.name,
    sharePercentage: i.sharePercentage,
    status: i.status,
    companyCutPct: i.companyCutPct ?? i.team?.companyCutPct ?? 0,
    partners: (i.partners ?? []).map((p: any) => ({
      name: p.name,
      role: p.role ?? null,
      percentage: p.percentage,
    })),
  }));
}

function reportFor(txns: any[], expenses: any[]) {
  return buildReport(
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
      categoryName: e.category?.name,
      investorId: e.investorId,
      chargedToInvestor: e.chargedToInvestor,
    }))
  );
}

// Full report for one team: overall + daily + investor split
reportsRouter.get("/summary", async (req, res) => {
  const { from, to, teamId } = req.query as Record<string, string>;
  const { txns, expenses, investors } = await loadData(teamId, from, to);

  const report = reportFor(txns, expenses);
  const engineInvestors = toInvestorInputs(investors);

  const split = investorSplit(report.overall, engineInvestors);
  const dailySplit = report.daily.map((day) => ({
    date: day.date,
    rows: investorSplit(day, engineInvestors),
  }));
  const companyEarnings =
    Math.round(split.reduce((s, r) => s + r.companyCut, 0) * 100) / 100;

  // expense totals per header — in base currency, since expenses can be
  // filed in different currencies and a raw sum would mix units.
  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    const baseAmount = e.amount * (e.fxRate ?? 1);
    byCategory.set(e.category.name, (byCategory.get(e.category.name) ?? 0) + baseAmount);
  }

  // expense totals per investor (tagged), split into charged vs just-tagged
  // — also in base currency, for the same reason.
  const byInvestor = new Map<string, { charged: number; tagged: number }>();
  for (const e of expenses) {
    if (!e.investorId) continue;
    const name = e.investor?.name ?? "Unknown";
    const baseAmount = e.amount * (e.fxRate ?? 1);
    const cur = byInvestor.get(name) ?? { charged: 0, tagged: 0 };
    if (e.chargedToInvestor) cur.charged += baseAmount;
    else cur.tagged += baseAmount;
    byInvestor.set(name, cur);
  }

  const team = teamId ? await prisma.team.findUnique({ where: { id: teamId } }) : null;

  res.json({
    ...report,
    teamId: teamId ?? null,
    teamName: team?.name ?? null,
    investorSplit: split,
    dailyInvestorSplit: dailySplit,
    companyEarnings,
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
    totalActiveShare:
      Math.round(
        investors
          .filter((i) => i.status === "ACTIVE")
          .reduce((s, i) => s + i.sharePercentage, 0) * 100
      ) / 100,
    counts: {
      investors: investors.length,
      transactions: txns.length,
      expenses: expenses.length,
    },
  });
});

// Headline P&L per team — for the "all teams" overview strip on the dashboard.
reportsRouter.get("/teams", async (_req, res) => {
  const teams = await prisma.team.findMany({ orderBy: { createdAt: "asc" } });
  const rows = await Promise.all(
    teams.map(async (team) => {
      const { txns, expenses, investors } = await loadData(team.id);
      const report = reportFor(txns, expenses);
      const split = investorSplit(report.overall, toInvestorInputs(investors));
      const companyEarnings =
        Math.round(split.reduce((s, r) => s + r.companyCut, 0) * 100) / 100;
      const totalCapital =
        Math.round(
          investors.reduce((s, i) => s + i.capitalInvested * (i.fxRate ?? 1), 0) * 100
        ) / 100;
      const o = report.overall;
      return {
        teamId: team.id,
        name: team.name,
        companyCutPct: team.companyCutPct,
        investors: investors.length,
        totalCapital,
        grossProfit: o.grossProfit,
        netProfit: o.netProfit,
        netLoss: o.netLoss,
        stockLeftGrams: o.stockLeftGrams,
        stockLeftValue: o.stockLeftValue,
        companyEarnings,
      };
    })
  );
  res.json(rows);
});
