import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { authRequired } from "../lib/auth.js";
import { buildReport, shareFor, type PeriodSummary } from "../lib/accounting.js";

export const portalRouter = Router();
// An investor sees only their own statement, scoped to their own team. An admin
// may pass ?investorId= to preview any investor's statement ("view as") without
// leaving their own session.
portalRouter.use(authRequired);

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * What an investor is allowed to see (from the brief):
 *  - the whole account totals for THEIR team, READ ONLY
 *  - PROFIT: the team's aggregate profit AND their own share — never another
 *    investor's share, never the investor list
 *  - LOSS: total loss and per-day loss are visible to every investor in full
 *
 * `companyCutPct` is the member's effective company cut: the company takes that %
 * of a positive share before the member's working/capital partner split.
 */
function investorView(
  summary: PeriodSummary,
  investorId: string,
  sharePct: number,
  companyCutPct: number
) {
  const frac = (sharePct || 0) / 100;
  const myCharged = round2(summary.chargedByInvestor[investorId] ?? 0);
  // my share of the common pool, my own charged expenses removed
  const myGrossShare2 = round2(summary.commonNetProfit * frac - myCharged);
  const myCompanyCut = myGrossShare2 > 0 ? round2((myGrossShare2 * (companyCutPct || 0)) / 100) : 0;
  const myNetShare = round2(myGrossShare2 - myCompanyCut);
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
    companyCutPct: companyCutPct || 0,
    myCompanyCut,
    myNetShare,
    // loss: fully visible
    totalLoss: summary.totalLoss,
    netLoss: summary.netLoss,
    myNetLossShare: myNetShare < 0 ? round2(-myNetShare) : 0,
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

  const investor = await prisma.investor.findUnique({
    where: { id: targetId },
    include: { team: true, partners: { orderBy: { createdAt: "asc" } } },
  });
  if (!investor) return res.status(404).json({ error: "Investor record not found" });

  const companyCutPct = investor.companyCutPct ?? investor.team?.companyCutPct ?? 0;

  const { from, to } = req.query as Record<string, string>;
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);
  const hasDate = from || to;

  // Scope everything to this investor's OWN team.
  const txnWhere: any = { teamId: investor.teamId ?? "__none__" };
  const expWhere: any = { teamId: investor.teamId ?? "__none__" };
  if (hasDate) {
    txnWhere.date = dateFilter;
    expWhere.date = dateFilter;
  }

  const [txns, expenses] = await Promise.all([
    prisma.goldTransaction.findMany({ where: txnWhere, orderBy: { date: "asc" } }),
    prisma.expense.findMany({ where: expWhere, orderBy: { date: "asc" } }),
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
  const overallView = investorView(report.overall, investor.id, pct, companyCutPct);

  // Second-level split: how this investor's own net share (already after the
  // company cut) is divided among their profit partners. Last partner absorbs
  // the rounding remainder.
  let allocated = 0;
  const partnerSplit = investor.partners.map((p, idx) => {
    const isLast = idx === investor.partners.length - 1;
    const share = isLast
      ? round2(overallView.myNetShare - allocated)
      : round2((overallView.myNetShare * (p.percentage || 0)) / 100);
    allocated = round2(allocated + share);
    return { name: p.name, role: p.role ?? null, percentage: p.percentage || 0, share };
  });

  res.json({
    investor: {
      name: investor.name,
      sharePercentage: pct,
      capitalInvested: investor.capitalInvested,
      joinedAt: investor.joinedAt,
      teamName: investor.team?.name ?? null,
      companyCutPct,
    },
    overall: {
      ...overallView,
      partnerSplit,
      buyByQuality: report.overall.buyByQuality,
      sellByQuality: report.overall.sellByQuality,
    },
    daily: report.daily.map((d) => investorView(d, investor.id, pct, companyCutPct)),
    generatedAt: report.generatedAt,
  });
});
