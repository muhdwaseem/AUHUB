import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useFetch } from "../../useApi";
import type { ReportSummary } from "../../types";
import { PageHeader, Dot } from "../../components/AppShell";
import { Spinner, ErrorNote, Stat, Card } from "../../components/ui";
import { money, grams, num, pct } from "../../format";

/**
 * The everyday cockpit: the ~6 figures that actually drive a decision, plus the
 * shares-not-100% alert. One API call (`/reports/summary`), no charts.
 * The full bento view is kept at /admin/dashboard-full.
 */
export default function DashboardLean() {
  const { data: s, loading, error } = useFetch<ReportSummary>("/reports/summary");

  if (loading) return <Spinner />;
  if (error || !s) return <ErrorNote>{error || "No data yet."}</ErrorNote>;

  const o = s.overall;
  const soldPct = o.goldBoughtGrams > 0 ? (o.goldSoldGrams / o.goldBoughtGrams) * 100 : 0;
  const marginPerG = o.avgSellRate - o.avgBuyRate;
  const unrealised =
    o.avgSellRate > 0 ? o.stockLeftGrams * (o.avgSellRate - o.avgBuyRate) : 0;
  const cashFlow = o.goldSoldValue - o.goldBoughtValue;
  const shareOff = Math.abs(s.totalActiveShare - 100) > 0.01;
  const cats = [...(s.expensesByCategory ?? [])].sort((a, b) => b.amount - a.amount);
  const maxCat = Math.max(1, ...cats.map((c) => c.amount));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            The whole book <Dot />
            <b className="font-mono text-[12px] font-semibold text-graphite-700">
              {s.counts.transactions}
            </b>{" "}
            trades <Dot />
            <b className="font-mono text-[12px] font-semibold text-graphite-700">
              {s.counts.expenses}
            </b>{" "}
            expenses <Dot />
            <b className="font-mono text-[12px] font-semibold text-graphite-700">
              {s.counts.investors}
            </b>{" "}
            investors
          </>
        }
        action={
          <>
            <Link
              to="/admin/gold"
              className="rounded-full bg-[linear-gradient(145deg,var(--color-gold-hi),var(--color-gold-500)_60%,var(--color-gold-lo))] px-4 py-[10px] text-[12.5px] font-semibold text-chrome-950 shadow-[0_8px_20px_-8px_var(--color-glow)] transition-transform duration-150 ease-out hover:brightness-105 active:scale-[0.97]"
            >
              Record trade
            </Link>
            <Link
              to="/admin/reports"
              className="glass-thin rounded-full border border-graphite-200 bg-ink-800 px-4 py-[9px] text-[12px] font-semibold text-graphite-700 transition-[color,border-color] duration-150 hover:border-gold-lo hover:text-graphite-900"
            >
              Profit &amp; Loss
            </Link>
          </>
        }
      />

      {shareOff && (
        <div className="glass-thin mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/[0.11] px-4 py-2.5 text-[13px] text-graphite-700 sm:rounded-full sm:px-5">
          <AlertTriangle size={16} className="flex-none text-warning" />
          <span>
            Active investor shares total{" "}
            <b className="font-mono font-semibold text-warning">{pct(s.totalActiveShare)}</b> — profit
            payouts stay locked until the book reaches 100%.
          </span>
          <Link
            to="/admin/investors"
            className="ml-auto text-[12px] font-semibold text-graphite-900 underline underline-offset-[3px]"
          >
            Fix in Investors →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Net profit · realised"
          value={money(o.netProfit)}
          sub={`Gross ${money(o.grossProfit)} · less ${money(o.totalExpenses)} expenses`}
          tone={o.netProfit >= 0 ? "positive" : "negative"}
          emphasis
        />
        <Stat
          label="Stock on hand"
          value={grams(o.stockLeftGrams)}
          sub={`${money(o.stockLeftValue)} at cost · ${num(soldPct, 0)}% of book sold`}
          tone="gold"
        />
        <Stat
          label="Unrealised on stock"
          value={`${unrealised >= 0 ? "+" : ""}${money(unrealised)}`}
          sub={o.avgSellRate > 0 ? "vs cost, at the current avg sell rate" : "no sales yet to price against"}
          tone={unrealised >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Margin / gram"
          value={money(marginPerG)}
          sub={`Avg buy ${num(o.avgBuyRate)} → avg sell ${num(o.avgSellRate)}`}
          tone={marginPerG >= 0 ? "positive" : "negative"}
        />
        <Stat
          label="Cash in vs out"
          value={`${cashFlow >= 0 ? "+" : ""}${money(cashFlow)}`}
          sub={`Sales ${money(o.goldSoldValue)} · purchases ${money(o.goldBoughtValue)}`}
          tone={cashFlow >= 0 ? "positive" : "negative"}
        />
        {o.netLoss > 0 ? (
          <Stat
            label="Net loss"
            value={money(o.netLoss)}
            sub="the book is in the red for this period"
            tone="negative"
          />
        ) : (
          <Stat
            label="Total expenses"
            value={money(o.totalExpenses)}
            sub={`${s.counts.expenses} posting${s.counts.expenses === 1 ? "" : "s"}`}
            tone="negative"
          />
        )}
      </div>

      {cats.length > 0 && (
        <Card title="Expenses by header" className="mt-4">
          <div className="space-y-3 p-4">
            {cats.slice(0, 5).map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-[12.5px]">
                  <span className="text-graphite-800">{c.name}</span>
                  <b className="font-mono tabular-nums">{money(c.amount)}</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <i
                    className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-gold-lo),var(--color-gold-500))]"
                    style={{ width: `${(c.amount / maxCat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-graphite-400">
        Cost basis: weighted-average purchase rate ({money(o.avgBuyRate)}/g).{" "}
        <Link to="/admin/dashboard-full" className="underline underline-offset-2 hover:text-graphite-600">
          Detailed dashboard →
        </Link>
      </p>
    </>
  );
}
