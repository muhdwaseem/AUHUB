/**
 * Accounting / profit-loss engine for the gold trading book.
 *
 * Cost model: Weighted Average Cost (WAC).
 *   avgBuyRate = total value of all purchases / total grams purchased
 *   Cost of Goods Sold (COGS) for a period = grams sold in period * avgBuyRate
 *   Gross profit (before expenses) = sale value - COGS
 *   Net profit (book bottom line) = gross profit - ALL expenses
 *
 * Expense attribution (hybrid):
 *   - "shared" expenses (no investor, or investor set but not charged) come out
 *     of the common pool and reduce every investor's share by their %.
 *   - "charged" expenses (investor set + chargedToInvestor = true) are deducted
 *     from that one investor's share only.
 *   The book's totalExpenses / netProfit are the same either way — only the
 *   split between investors changes.
 *
 *   commonNetProfit          = grossProfit - sharedExpenses
 *   investor i's net share   = commonNetProfit * frac_i - (expenses charged to i)
 *
 * "Stock left" is cumulative: every gram bought up to a date minus every gram
 * sold up to that date, valued at avgBuyRate.
 *
 * Losses (gross loss and net loss) are the negative side of the same numbers,
 * surfaced as positive magnitudes so the UI can show "Total Loss".
 */

export interface TxnInput {
  type: string; // BUY | SELL
  date: Date;
  quality: string;
  quantityGrams: number;
  ratePerGram: number;
  totalAmount: number;
}

export interface ExpenseInput {
  amount: number;
  date: Date;
  categoryName?: string;
  investorId?: string | null;
  chargedToInvestor?: boolean;
}

export interface QualityBreakdownRow {
  quality: string;
  grams: number;
  value: number;
  avgRate: number;
}

export interface PeriodSummary {
  /** ISO date (yyyy-mm-dd) for a daily row, or null for the overall summary. */
  date: string | null;
  goldBoughtGrams: number;
  goldBoughtValue: number;
  avgBuyRate: number;
  goldSoldGrams: number;
  goldSoldValue: number;
  avgSellRate: number;
  cogs: number;
  stockLeftGrams: number;
  stockLeftValue: number;
  grossProfit: number; // profit total WITHOUT expenses (can be negative)
  totalExpenses: number; // shared + charged (book level)
  sharedExpenses: number; // pooled, split by %
  chargedExpenses: number; // total attributed to individual investors
  commonNetProfit: number; // grossProfit - sharedExpenses (basis for the % split)
  netProfit: number; // grossProfit - totalExpenses (book bottom line, can be negative)
  totalLoss: number; // magnitude of gross loss, else 0
  netLoss: number; // magnitude of net loss, else 0
  /** investorId -> amount charged to that investor in this period */
  chargedByInvestor: Record<string, number>;
  buyByQuality: QualityBreakdownRow[];
  sellByQuality: QualityBreakdownRow[];
}

export interface InvestorSplitRow {
  investorId: string;
  name: string;
  sharePercentage: number;
  grossShare: number;
  sharedExpenseShare: number; // their % of the pooled expenses
  chargedExpenses: number; // expenses charged directly to them
  netShare: number; // commonNetProfit * frac - chargedExpenses
  netLossShare: number;
}

const round = (n: number, dp = 2) => {
  const f = Math.pow(10, dp);
  return Math.round((n + Number.EPSILON) * f) / f;
};

const dayKey = (d: Date) => new Date(d).toISOString().slice(0, 10);

function groupByQuality(rows: TxnInput[]): QualityBreakdownRow[] {
  const map = new Map<string, { grams: number; value: number }>();
  for (const r of rows) {
    const cur = map.get(r.quality) ?? { grams: 0, value: 0 };
    cur.grams += r.quantityGrams;
    cur.value += r.totalAmount;
    map.set(r.quality, cur);
  }
  return [...map.entries()]
    .map(([quality, v]) => ({
      quality,
      grams: round(v.grams, 3),
      value: round(v.value),
      avgRate: v.grams > 0 ? round(v.value / v.grams) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

function isCharged(e: ExpenseInput): boolean {
  return !!e.chargedToInvestor && !!e.investorId;
}

function buildPeriod(
  date: string | null,
  periodTxns: TxnInput[],
  periodExpenses: ExpenseInput[],
  avgBuyRate: number,
  cumulativeBoughtGrams: number,
  cumulativeSoldGrams: number
): PeriodSummary {
  const buys = periodTxns.filter((t) => t.type === "BUY");
  const sells = periodTxns.filter((t) => t.type === "SELL");

  const goldBoughtGrams = round(buys.reduce((s, t) => s + t.quantityGrams, 0), 3);
  const goldBoughtValue = round(buys.reduce((s, t) => s + t.totalAmount, 0));
  const goldSoldGrams = round(sells.reduce((s, t) => s + t.quantityGrams, 0), 3);
  const goldSoldValue = round(sells.reduce((s, t) => s + t.totalAmount, 0));

  const cogs = round(goldSoldGrams * avgBuyRate);
  const grossProfit = round(goldSoldValue - cogs);

  const totalExpenses = round(periodExpenses.reduce((s, e) => s + e.amount, 0));
  const chargedExpenses = round(
    periodExpenses.filter(isCharged).reduce((s, e) => s + e.amount, 0)
  );
  const sharedExpenses = round(totalExpenses - chargedExpenses);

  const chargedByInvestor: Record<string, number> = {};
  for (const e of periodExpenses.filter(isCharged)) {
    chargedByInvestor[e.investorId!] =
      round((chargedByInvestor[e.investorId!] ?? 0) + e.amount);
  }

  const netProfit = round(grossProfit - totalExpenses);
  const commonNetProfit = round(grossProfit - sharedExpenses);

  const stockLeftGrams = round(cumulativeBoughtGrams - cumulativeSoldGrams, 3);
  const stockLeftValue = round(stockLeftGrams * avgBuyRate);

  return {
    date,
    goldBoughtGrams,
    goldBoughtValue,
    avgBuyRate: round(avgBuyRate),
    goldSoldGrams,
    goldSoldValue,
    avgSellRate: goldSoldGrams > 0 ? round(goldSoldValue / goldSoldGrams) : 0,
    cogs,
    stockLeftGrams,
    stockLeftValue,
    grossProfit,
    totalExpenses,
    sharedExpenses,
    chargedExpenses,
    commonNetProfit,
    netProfit,
    totalLoss: grossProfit < 0 ? round(-grossProfit) : 0,
    netLoss: netProfit < 0 ? round(-netProfit) : 0,
    chargedByInvestor,
    buyByQuality: groupByQuality(buys),
    sellByQuality: groupByQuality(sells),
  };
}

export interface FullReport {
  overall: PeriodSummary;
  daily: PeriodSummary[];
  generatedAt: string;
}

export function buildReport(txns: TxnInput[], expenses: ExpenseInput[]): FullReport {
  const totalBuyGrams = txns
    .filter((t) => t.type === "BUY")
    .reduce((s, t) => s + t.quantityGrams, 0);
  const totalBuyValue = txns
    .filter((t) => t.type === "BUY")
    .reduce((s, t) => s + t.totalAmount, 0);
  const avgBuyRate = totalBuyGrams > 0 ? totalBuyValue / totalBuyGrams : 0;

  const totalSoldGrams = txns
    .filter((t) => t.type === "SELL")
    .reduce((s, t) => s + t.quantityGrams, 0);

  const overall = buildPeriod(
    null,
    txns,
    expenses,
    avgBuyRate,
    totalBuyGrams,
    totalSoldGrams
  );

  // Daily rows
  const dates = new Set<string>();
  txns.forEach((t) => dates.add(dayKey(t.date)));
  expenses.forEach((e) => dates.add(dayKey(e.date)));
  const sortedDates = [...dates].sort();

  let runningBought = 0;
  let runningSold = 0;
  const daily: PeriodSummary[] = [];
  for (const d of sortedDates) {
    const dayTxns = txns.filter((t) => dayKey(t.date) === d);
    const dayExpenses = expenses.filter((e) => dayKey(e.date) === d);
    runningBought += dayTxns
      .filter((t) => t.type === "BUY")
      .reduce((s, t) => s + t.quantityGrams, 0);
    runningSold += dayTxns
      .filter((t) => t.type === "SELL")
      .reduce((s, t) => s + t.quantityGrams, 0);
    daily.push(
      buildPeriod(d, dayTxns, dayExpenses, avgBuyRate, runningBought, runningSold)
    );
  }

  return { overall, daily, generatedAt: new Date().toISOString() };
}

export function investorSplit(
  summary: PeriodSummary,
  investors: { id: string; name: string; sharePercentage: number; status: string }[]
): InvestorSplitRow[] {
  return investors
    .filter((i) => i.status === "ACTIVE")
    .map((i) => {
      const frac = (i.sharePercentage || 0) / 100;
      const charged = round(summary.chargedByInvestor[i.id] ?? 0);
      const netShare = round(summary.commonNetProfit * frac - charged);
      return {
        investorId: i.id,
        name: i.name,
        sharePercentage: i.sharePercentage,
        grossShare: round(summary.grossProfit * frac),
        sharedExpenseShare: round(summary.sharedExpenses * frac),
        chargedExpenses: charged,
        netShare,
        netLossShare: netShare < 0 ? round(-netShare) : 0,
      };
    });
}

/** Share of a single number for one investor (used by the investor portal). */
export function shareFor(value: number, sharePercentage: number): number {
  return round(value * ((sharePercentage || 0) / 100));
}
