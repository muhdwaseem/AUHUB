import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../lib/auth.js";
import { buildReport, shareFor, type PeriodSummary } from "../lib/accounting.js";

export const portalRouter = Router();
// An investor sees only their own statement. An admin may pass ?investorId= to
// preview any investor's statement ("view as") without leaving their own session.
portalRouter.use(authRequired);

/**
 * What an investor is allowed to see (from the brief):
 *  - the whole account totals, READ ONLY
 *  - PROFIT: only the aggregate total profit AND their own share — never another
 *    investor's share, never the investor list
 *  - LOSS: total loss and per-day loss are visible to every investor in full
 */
function investorView(
  summary: PeriodSummary,
  investorId: string,
  sharePct: number
) {
  const frac = (sharePct || 0) / 100;
  const myCharged = Math.round((summary.chargedByInvestor[investorId] ?? 0) * 100) / 100;
  // my share of the common pool, then my own charged expenses removed
  const myNetShare = Math.round((summary.commonNetProfit * frac - myCharged) * 100) / 100;
  return {
    date: summary.date,
    // gold movement + stock (part of "the whole account")
    goldBoughtGrams: summary.goldBoughtGrams,
    goldBoughtValue: summary.goldBoughtValue,
    goldSoldGrams: summary.goldSoldGrams,
    goldSoldValue: summary.goldSoldValue,
    stockLeftGrams: summary.stockLeftGrams,
    stockLeftValue: summary.stockLeftValue,
    // profit: book totals + my share only
    grossProfit: summary.grossProfit,
    totalExpenses: summary.totalExpenses,
    sharedExpenses: summary.sharedExpenses,
    chargedExpensesTotal: summary.chargedExpenses,
    netProfit: summary.netProfit,
    myGrossShare: shareFor(summary.grossProfit, sharePct),
    mySharedExpenseShare: shareFor(summary.sharedExpenses, sharePct),
    myChargedExpenses: myCharged,
    myNetShare,
    // loss: fully visible
    totalLoss: summary.totalLoss,
    netLoss: summary.netLoss,
    myNetLossShare: myNetShare < 0 ? Math.round(-myNetShare * 100) / 100 : 0,
  };
}

portalRouter.get("/summary", async (req, res) => {
  const isAdmin = req.auth!.role === "ADMIN";
  // Investors are always pinned to their own id; the query param is ignored for
  // them so it can't be used to peek at another investor.
  const targetId = isAdmin
    ? String((req.query.investorId as string) || "")
    : req.auth!.investorId;
  if (!targetId)
    return res
      .status(isAdmin ? 400 : 403)
      .json({ error: isAdmin ? "investorId is required" : "Investor access required" });

  const investor = await prisma.investor.findUnique({ where: { id: targetId } });
  if (!investor) return res.status(404).json({ error: "Investor record not found" });

  const { from, to } = req.query as Record<string, string>;
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasFilter = from || to;

  const [txns, expenses] = await Promise.all([
    prisma.goldTransaction.findMany({
      where: hasFilter ? { date: dateFilter } : undefined,
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({
      where: hasFilter ? { date: dateFilter } : undefined,
      orderBy: { date: "asc" },
    }),
  ]);

  // Convert every amount to the base currency (fxRate) before the engine runs.
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
      investorId: e.investorId,
      chargedToInvestor: e.chargedToInvestor,
    }))
  );

  const pct = investor.sharePercentage;
  res.json({
    investor: {
      name: investor.name,
      sharePercentage: pct,
      capitalInvested: investor.capitalInvested,
      joinedAt: investor.joinedAt,
    },
    overall: {
      ...investorView(report.overall, investor.id, pct),
      buyByQuality: report.overall.buyByQuality,
      sellByQuality: report.overall.sellByQuality,
    },
    daily: report.daily.map((d) => investorView(d, investor.id, pct)),
    generatedAt: report.generatedAt,
  });
});
