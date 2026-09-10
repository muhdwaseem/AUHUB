import { describe, it, expect } from "vitest";
import {
  buildReport,
  investorSplit,
  shareFor,
  type TxnInput,
  type ExpenseInput,
  type PeriodSummary,
} from "./accounting.js";

/**
 * These tests are the written spec for the profit-loss engine. Each block says,
 * in plain terms, what the engine is doing and pins the arithmetic so a future
 * rounding or attribution change can't silently pay an investor the wrong amount.
 *
 * The engine has no I/O — it takes plain transaction and expense rows (already
 * converted to the base currency by the route layer) and returns a report.
 */

// --- fixture helpers -------------------------------------------------------

const buy = (
  date: string,
  quantityGrams: number,
  ratePerGram: number,
  quality = "24K"
): TxnInput => ({
  type: "BUY",
  date: new Date(date),
  quality,
  quantityGrams,
  ratePerGram,
  totalAmount: quantityGrams * ratePerGram,
});

const sell = (
  date: string,
  quantityGrams: number,
  ratePerGram: number,
  quality = "24K"
): TxnInput => ({
  type: "SELL",
  date: new Date(date),
  quality,
  quantityGrams,
  ratePerGram,
  totalAmount: quantityGrams * ratePerGram,
});

const expense = (
  date: string,
  amount: number,
  opts: { investorId?: string; chargedToInvestor?: boolean } = {}
): ExpenseInput => ({
  date: new Date(date),
  amount,
  investorId: opts.investorId ?? null,
  chargedToInvestor: opts.chargedToInvestor ?? false,
});

/** A PeriodSummary with everything zeroed — override just the fields under test. */
function emptySummary(over: Partial<PeriodSummary> = {}): PeriodSummary {
  return {
    date: null,
    goldBoughtGrams: 0,
    goldBoughtValue: 0,
    avgBuyRate: 0,
    goldSoldGrams: 0,
    goldSoldValue: 0,
    avgSellRate: 0,
    cogs: 0,
    stockLeftGrams: 0,
    stockLeftValue: 0,
    grossProfit: 0,
    totalExpenses: 0,
    sharedExpenses: 0,
    chargedExpenses: 0,
    commonNetProfit: 0,
    netProfit: 0,
    totalLoss: 0,
    netLoss: 0,
    chargedByInvestor: {},
    buyByQuality: [],
    sellByQuality: [],
    ...over,
  };
}

// -------------------------------------------------------------------------
describe("buildReport — weighted-average cost basis (WAC)", () => {
  it("prices sold gold at the average of ALL purchases, not the price of any one lot", () => {
    const { overall } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 100, 200), // 20 000
        buy("2026-01-12T12:00:00Z", 100, 240), // 24 000
        sell("2026-01-15T12:00:00Z", 150, 300), // 45 000
      ],
      []
    );

    // avgBuyRate = 44 000 / 200 g = 220  (weighted, not (200+240)/2 = 220 here by
    // coincidence of equal grams — see the next test for the weighted case)
    expect(overall.avgBuyRate).toBe(220);
    // COGS = grams sold * avgBuyRate = 150 * 220
    expect(overall.cogs).toBe(33_000);
    // gross profit = sale value - COGS  (expenses are NOT in this number)
    expect(overall.grossProfit).toBe(12_000);
    expect(overall.avgSellRate).toBe(300);
    expect(overall.goldBoughtGrams).toBe(200);
    expect(overall.goldBoughtValue).toBe(44_000);
    expect(overall.goldSoldGrams).toBe(150);
    expect(overall.goldSoldValue).toBe(45_000);
  });

  it("weights the average by grams, not by lot count", () => {
    const { overall } = buildReport(
      [
        buy("2026-02-01T12:00:00Z", 10, 100), // 10 g cheap
        buy("2026-02-02T12:00:00Z", 90, 200), // 90 g dear
      ],
      []
    );
    // (1 000 + 18 000) / 100 g = 190  — close to 200, far from the 150 midpoint
    expect(overall.avgBuyRate).toBe(190);
  });

  it("keeps full precision internally even though the reported avgBuyRate is rounded to 2dp", () => {
    const { overall } = buildReport(
      [
        buy("2026-03-01T12:00:00Z", 100, 100), // 10 000
        buy("2026-03-02T12:00:00Z", 50, 150), // 7 500
        sell("2026-03-03T12:00:00Z", 40, 150), // 6 000
      ],
      []
    );
    // true rate = 17 500 / 150 = 116.66667
    expect(overall.avgBuyRate).toBe(116.67); // display value, rounded
    // COGS uses the un-rounded rate: 40 * 116.66667 = 4 666.6667 -> 4 666.67
    expect(overall.cogs).toBe(4_666.67);
    expect(overall.grossProfit).toBe(1_333.33); // 6 000 - 4 666.67
  });

  it("with purchases but no sales, gross profit is zero and all gold is stock", () => {
    const { overall } = buildReport([buy("2026-01-01T12:00:00Z", 100, 200)], []);
    expect(overall.grossProfit).toBe(0);
    expect(overall.goldSoldGrams).toBe(0);
    expect(overall.stockLeftGrams).toBe(100);
    expect(overall.stockLeftValue).toBe(20_000); // 100 g * avgBuyRate 200
    expect(overall.avgSellRate).toBe(0);
  });
});

describe("buildReport — stock on hand", () => {
  it("is cumulative grams bought minus cumulative grams sold, valued at avgBuyRate", () => {
    const { overall } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 300, 200),
        sell("2026-01-20T12:00:00Z", 120, 260),
      ],
      []
    );
    expect(overall.stockLeftGrams).toBe(180);
    expect(overall.stockLeftValue).toBe(36_000); // 180 * 200
  });
});

describe("buildReport — gross vs net, and how expenses are attributed", () => {
  const txns = [
    buy("2026-01-10T12:00:00Z", 100, 200),
    buy("2026-01-12T12:00:00Z", 100, 240),
    sell("2026-01-15T12:00:00Z", 150, 300),
  ]; // grossProfit = 12 000

  it("a shared expense lowers net profit and the common pool, but not gross profit", () => {
    const { overall } = buildReport(txns, [expense("2026-01-15T12:00:00Z", 1_000)]);
    expect(overall.grossProfit).toBe(12_000);
    expect(overall.totalExpenses).toBe(1_000);
    expect(overall.sharedExpenses).toBe(1_000);
    expect(overall.chargedExpenses).toBe(0);
    expect(overall.netProfit).toBe(11_000); // gross - all expenses
    expect(overall.commonNetProfit).toBe(11_000); // gross - shared expenses
  });

  it("an expense tagged to an investor but NOT charged is still a shared expense", () => {
    const { overall } = buildReport(txns, [
      expense("2026-01-16T12:00:00Z", 300, { investorId: "inv2", chargedToInvestor: false }),
    ]);
    expect(overall.sharedExpenses).toBe(300);
    expect(overall.chargedExpenses).toBe(0);
    expect(overall.chargedByInvestor).toEqual({});
  });

  it("a charged expense comes out of that one investor's share only", () => {
    const { overall } = buildReport(txns, [
      expense("2026-01-15T12:00:00Z", 1_000), // shared
      expense("2026-01-15T12:00:00Z", 500, { investorId: "inv1", chargedToInvestor: true }),
      expense("2026-01-16T12:00:00Z", 300, { investorId: "inv2", chargedToInvestor: false }),
    ]);
    expect(overall.totalExpenses).toBe(1_800); // 1000 + 500 + 300
    expect(overall.chargedExpenses).toBe(500);
    expect(overall.sharedExpenses).toBe(1_300); // 1800 - 500
    expect(overall.chargedByInvestor).toEqual({ inv1: 500 });
    expect(overall.netProfit).toBe(10_200); // 12 000 - 1 800  (book bottom line, same either way)
    expect(overall.commonNetProfit).toBe(10_700); // 12 000 - 1 300  (basis for the % split)
  });

  it("sums multiple charged expenses per investor", () => {
    const { overall } = buildReport(txns, [
      expense("2026-01-15T12:00:00Z", 200, { investorId: "inv1", chargedToInvestor: true }),
      expense("2026-01-16T12:00:00Z", 50, { investorId: "inv1", chargedToInvestor: true }),
      expense("2026-01-16T12:00:00Z", 400, { investorId: "inv2", chargedToInvestor: true }),
    ]);
    expect(overall.chargedByInvestor).toEqual({ inv1: 250, inv2: 400 });
  });
});

describe("buildReport — losses are surfaced as positive magnitudes", () => {
  it("selling below cost makes grossProfit negative and totalLoss its magnitude", () => {
    const { overall } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 100, 300), // cost 300/g
        sell("2026-01-15T12:00:00Z", 100, 250), // sold at a loss
      ],
      []
    );
    expect(overall.grossProfit).toBe(-5_000);
    expect(overall.totalLoss).toBe(5_000); // positive magnitude for the UI
    expect(overall.netLoss).toBe(5_000); // no expenses, so same
  });

  it("a gross profit that expenses turn negative shows netLoss but zero totalLoss", () => {
    const { overall } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 100, 200),
        sell("2026-01-15T12:00:00Z", 100, 210), // +1 000 gross
      ],
      [expense("2026-01-15T12:00:00Z", 2_500)]
    );
    expect(overall.grossProfit).toBe(1_000);
    expect(overall.totalLoss).toBe(0); // the trading itself was profitable
    expect(overall.netProfit).toBe(-1_500);
    expect(overall.netLoss).toBe(1_500); // the book bottom line is red
  });
});

describe("buildReport — daily rows", () => {
  it("emits one row per distinct calendar day, in ascending date order", () => {
    const { daily } = buildReport(
      [
        sell("2026-01-15T12:00:00Z", 10, 300),
        buy("2026-01-10T12:00:00Z", 100, 200),
        buy("2026-01-12T12:00:00Z", 100, 240),
      ],
      []
    );
    expect(daily.map((d) => d.date)).toEqual(["2026-01-10", "2026-01-12", "2026-01-15"]);
  });

  it("gives a day its own row even when only an expense landed that day", () => {
    const { daily } = buildReport(
      [buy("2026-01-10T12:00:00Z", 100, 200)],
      [expense("2026-02-01T12:00:00Z", 500)]
    );
    const feb = daily.find((d) => d.date === "2026-02-01")!;
    expect(feb).toBeDefined();
    expect(feb.goldBoughtGrams).toBe(0);
    expect(feb.totalExpenses).toBe(500);
    expect(feb.netProfit).toBe(-500);
    expect(feb.netLoss).toBe(500);
  });

  it("carries stock forward across days (cumulative), priced at the whole-book avgBuyRate", () => {
    const { daily } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 100, 200),
        buy("2026-01-12T12:00:00Z", 100, 240),
        sell("2026-01-15T12:00:00Z", 150, 300),
      ],
      []
    );
    const [d1, d2, d3] = daily;
    expect(d1.stockLeftGrams).toBe(100);
    expect(d2.stockLeftGrams).toBe(200);
    expect(d3.stockLeftGrams).toBe(50);
    // every day uses the SAME avgBuyRate (220) — the overall weighted average,
    // not a rate as-of that day. A deliberate simplification: the book runs on
    // one cost basis. Day 1's stock is valued at 220 even though only the 200/g
    // lot existed then.
    expect(d1.avgBuyRate).toBe(220);
    expect(d1.stockLeftValue).toBe(22_000); // 100 * 220
    expect(d3.cogs).toBe(33_000); // 150 * 220
    expect(d3.grossProfit).toBe(12_000);
  });

  it("daily net profits reconcile to the overall (with a single-day book)", () => {
    const { overall, daily } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 100, 200),
        sell("2026-01-10T12:00:00Z", 100, 250),
      ],
      [expense("2026-01-10T12:00:00Z", 300)]
    );
    expect(daily).toHaveLength(1);
    expect(daily[0].netProfit).toBe(overall.netProfit);
    expect(overall.netProfit).toBe(4_700); // (25 000 - 20 000) - 300
  });
});

describe("buildReport — quality breakdown", () => {
  it("groups buys and sells by quality, highest value first, with an average rate", () => {
    const { overall } = buildReport(
      [
        buy("2026-01-10T12:00:00Z", 100, 200, "24K"), // 20 000
        buy("2026-01-11T12:00:00Z", 100, 240, "22K"), // 24 000
        buy("2026-01-12T12:00:00Z", 50, 200, "24K"), // 10 000 -> 24K total 30 000
        sell("2026-01-15T12:00:00Z", 40, 300, "24K"), // 12 000
      ],
      []
    );
    expect(overall.buyByQuality).toEqual([
      { quality: "24K", grams: 150, value: 30_000, avgRate: 200 },
      { quality: "22K", grams: 100, value: 24_000, avgRate: 240 },
    ]);
    expect(overall.sellByQuality).toEqual([
      { quality: "24K", grams: 40, value: 12_000, avgRate: 300 },
    ]);
  });
});

describe("buildReport — empty book", () => {
  it("returns all zeros and no daily rows", () => {
    const { overall, daily } = buildReport([], []);
    expect(daily).toEqual([]);
    expect(overall.grossProfit).toBe(0);
    expect(overall.netProfit).toBe(0);
    expect(overall.avgBuyRate).toBe(0);
    expect(overall.stockLeftGrams).toBe(0);
    expect(overall.buyByQuality).toEqual([]);
  });
});

// -------------------------------------------------------------------------
describe("investorSplit — dividing the common net pool by share %", () => {
  const summary = emptySummary({
    grossProfit: 12_000,
    sharedExpenses: 1_300,
    commonNetProfit: 10_700,
    chargedByInvestor: { inv1: 500 },
  });

  it("gives each active investor commonNetProfit * their% minus what was charged to them", () => {
    const rows = investorSplit(summary, [
      { id: "inv1", name: "Ravi", sharePercentage: 60, status: "ACTIVE" },
      { id: "inv2", name: "Priya", sharePercentage: 40, status: "ACTIVE" },
    ]);

    expect(rows).toHaveLength(2);

    const ravi = rows[0];
    expect(ravi.grossShare).toBe(7_200); // 12 000 * 60%
    expect(ravi.sharedExpenseShare).toBe(780); // 1 300 * 60%
    expect(ravi.chargedExpenses).toBe(500);
    expect(ravi.netShare).toBe(5_920); // 10 700 * 60% - 500
    expect(ravi.netLossShare).toBe(0);

    const priya = rows[1];
    expect(priya.chargedExpenses).toBe(0);
    expect(priya.netShare).toBe(4_280); // 10 700 * 40%
  });

  it("skips investors who are not ACTIVE", () => {
    const rows = investorSplit(summary, [
      { id: "inv1", name: "Ravi", sharePercentage: 60, status: "ACTIVE" },
      { id: "inv3", name: "Old", sharePercentage: 100, status: "INACTIVE" },
    ]);
    expect(rows.map((r) => r.name)).toEqual(["Ravi"]);
  });

  it("reports a negative net share as a positive netLossShare", () => {
    const lossSummary = emptySummary({ commonNetProfit: -1_000 });
    const [row] = investorSplit(lossSummary, [
      { id: "inv1", name: "Ravi", sharePercentage: 50, status: "ACTIVE" },
    ]);
    expect(row.netShare).toBe(-500);
    expect(row.netLossShare).toBe(500);
  });
});

describe("investorSplit — second-level split among an investor's profit partners", () => {
  it("divides the investor's net share by each partner's percentage", () => {
    const summary = emptySummary({ commonNetProfit: 1_000 });
    const [row] = investorSplit(summary, [
      {
        id: "inv1",
        name: "Naimath",
        sharePercentage: 100,
        status: "ACTIVE",
        partners: [
          { name: "Naimath", role: "Capital", percentage: 50 },
          { name: "Mujeeb", role: "Working", percentage: 50 },
        ],
      },
    ]);
    expect(row.netShare).toBe(1_000);
    expect(row.partnerSplit).toEqual([
      { name: "Naimath", role: "Capital", percentage: 50, share: 500 },
      { name: "Mujeeb", role: "Working", percentage: 50, share: 500 },
    ]);
  });

  it("makes the LAST partner absorb the rounding remainder so the parts re-sum exactly", () => {
    const summary = emptySummary({ commonNetProfit: 100 });
    const [row] = investorSplit(summary, [
      {
        id: "inv1",
        name: "Trio",
        sharePercentage: 100,
        status: "ACTIVE",
        partners: [
          { name: "A", role: null, percentage: 33.33 },
          { name: "B", role: null, percentage: 33.33 },
          { name: "C", role: null, percentage: 33.33 },
        ],
      },
    ]);
    const shares = row.partnerSplit.map((p) => p.share);
    expect(shares).toEqual([33.33, 33.33, 33.34]); // C mops up the last cent
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("last partner absorbs the remainder even when it means they get nothing", () => {
    const summary = emptySummary({ commonNetProfit: 0.01 });
    const [row] = investorSplit(summary, [
      {
        id: "inv1",
        name: "Pair",
        sharePercentage: 100,
        status: "ACTIVE",
        partners: [
          { name: "A", role: null, percentage: 50 },
          { name: "B", role: null, percentage: 50 },
        ],
      },
    ]);
    // 0.01 * 50% rounds to 0.01 for A; B gets 0.01 - 0.01 = 0
    expect(row.partnerSplit.map((p) => p.share)).toEqual([0.01, 0]);
  });

  it("splits a loss across partners proportionally (negative shares)", () => {
    const summary = emptySummary({ commonNetProfit: -100 });
    const [row] = investorSplit(summary, [
      {
        id: "inv1",
        name: "Pair",
        sharePercentage: 100,
        status: "ACTIVE",
        partners: [
          { name: "A", role: null, percentage: 50 },
          { name: "B", role: null, percentage: 50 },
        ],
      },
    ]);
    expect(row.netShare).toBe(-100);
    expect(row.partnerSplit.map((p) => p.share)).toEqual([-50, -50]);
  });

  it("leaves partnerSplit empty when the investor has no partners (they keep 100%)", () => {
    const summary = emptySummary({ commonNetProfit: 1_000 });
    const [row] = investorSplit(summary, [
      { id: "inv1", name: "Solo", sharePercentage: 100, status: "ACTIVE", partners: [] },
    ]);
    expect(row.partnerSplit).toEqual([]);
  });
});

// -------------------------------------------------------------------------
describe("shareFor — one investor's slice of a single figure", () => {
  it("takes the percentage and rounds to 2dp", () => {
    expect(shareFor(1_000, 60)).toBe(600);
    expect(shareFor(1_000, 33.33)).toBe(333.3);
    expect(shareFor(0, 50)).toBe(0);
  });

  it("treats a missing/zero percentage as zero", () => {
    expect(shareFor(1_000, 0)).toBe(0);
    expect(shareFor(1_000, undefined as unknown as number)).toBe(0);
  });
});
