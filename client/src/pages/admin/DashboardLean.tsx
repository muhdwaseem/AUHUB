import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useFetch } from "../../useApi";
import type { ReportSummary, TeamOverviewRow, Expense } from "../../types";
import { PageHeader, Dot } from "../../components/AppShell";
import { Spinner, ErrorNote, Stat, Card } from "../../components/ui";
import { money, grams, num, pct } from "../../format";
import { useTeam } from "../../team";

/**
 * The everyday cockpit: the ~6 figures that actually drive a decision, plus the
 * shares-not-100% alert. One API call (`/reports/summary`), no charts.
 * The full bento view is kept at /admin/dashboard-full.
 */
export default function DashboardLean() {
  const { activeTeamId, activeTeam, teams, setActiveTeam } = useTeam();
  const { data: s, loading, error } = useFetch<ReportSummary>(
    activeTeamId ? `/reports/summary?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );
  const { data: teamRows } = useFetch<TeamOverviewRow[]>("/reports/teams");
  const { data: expensesData } = useFetch<{ expenses: Expense[] }>(
    activeTeamId ? `/expenses?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );

  if (!activeTeamId)
    return (
      <>
        <PageHeader title="Dashboard" subtitle="Pick or create a team to see its book." />
        <Card>
          <p className="px-5 py-14 text-center text-sm text-graphite-400">
            No team yet. Add one on the <b className="text-graphite-600">Teams</b> page.
          </p>
        </Card>
      </>
    );
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
  const expenseCurrencies = [...new Set((expensesData?.expenses ?? []).map((e) => e.currencyCode))].sort();

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            <b className="text-graphite-700">{activeTeam?.name ?? "This team"}</b> <Dot />
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

      {teamRows && teamRows.length > 1 && (
        <Card title="All teams" className="mb-4">
          <div className="divide-y divide-graphite-50">
            {teamRows.map((t) => (
              <button
                key={t.teamId}
                onClick={() => setActiveTeam(t.teamId)}
                className={`flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5 text-left text-[12.5px] transition-colors hover:bg-graphite-50/60 ${
                  t.teamId === activeTeamId ? "bg-graphite-50/50" : ""
                }`}
              >
                <span className="font-medium text-graphite-800">
                  {t.name}
                  {t.teamId === activeTeamId && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-accent-text">
                      viewing
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-x-4 gap-y-0.5 text-graphite-500">
                  <span>
                    Net{" "}
                    <b className={`tnum ${t.netProfit >= 0 ? "text-positive" : "text-negative"}`}>
                      {money(t.netProfit)}
                    </b>
                  </span>
                  <span>
                    Stock <b className="tnum text-graphite-700">{money(t.stockLeftValue)}</b>
                  </span>
                  <span>
                    Capital <b className="tnum text-graphite-700">{money(t.totalCapital)}</b>
                  </span>
                  <span>
                    Company <b className="tnum text-graphite-700">{money(t.companyEarnings)}</b>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
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
          label="Company earnings"
          value={money(s.companyEarnings)}
          sub="the company's cut across this team's members"
          tone="gold"
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

      {s.investorSplit.length > 0 && (
        <Card title="Profit distribution" className="mt-4">
          <div className="space-y-2 p-4 text-[13px]">
            <div className="flex justify-between border-b border-graphite-100 pb-2 font-semibold">
              <span className="text-graphite-800">Book net profit</span>
              <span className={`tnum ${o.netProfit >= 0 ? "text-positive" : "text-negative"}`}>
                {money(o.netProfit)}
              </span>
            </div>
            {s.investorSplit.map((r) => (
              <div key={r.investorId}>
                <div className="flex justify-between">
                  <span className="text-graphite-700">
                    {r.name} <span className="text-graphite-400">· {pct(r.sharePercentage)}</span>
                  </span>
                  <span className={`tnum font-medium ${r.netShare >= 0 ? "text-graphite-900" : "text-negative"}`}>
                    {money(r.netShare)}
                  </span>
                </div>
                {r.companyCut > 0 && (
                  <div className="flex justify-between pl-4 text-[12px] text-graphite-400">
                    <span>
                      ↳ company cut{" "}
                      <span className="text-graphite-500">{r.companyCutPct}%</span> (from{" "}
                      {money(r.grossMemberShare)})
                    </span>
                    <span className="tnum">− {money(r.companyCut)}</span>
                  </div>
                )}
                {r.partnerSplit.map((p, i) => (
                  <div key={i} className="flex justify-between pl-4 text-[12px] text-graphite-400">
                    <span className="truncate">
                      ↳ {p.name}
                      {p.role ? ` · ${p.role}` : ""} <span className="text-graphite-500">{p.percentage}%</span>
                    </span>
                    <span className={`tnum ${p.share < 0 ? "text-negative" : "text-graphite-600"}`}>
                      {money(p.share)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
            {s.companyEarnings > 0 && (
              <div className="flex justify-between border-t border-graphite-100 pt-2 text-[12.5px] font-semibold">
                <span className="text-graphite-700">Company earnings (total)</span>
                <span className="tnum text-accent-text">{money(s.companyEarnings)}</span>
              </div>
            )}
          </div>
        </Card>
      )}

      {cats.length > 0 && (
        <Card
          title="Expenses by header"
          className="mt-4"
          action={
            expenseCurrencies.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-1">
                {expenseCurrencies.map((code) => (
                  <span
                    key={code}
                    className="rounded-full bg-graphite-100 px-1.5 py-0.5 text-[10px] font-medium text-graphite-500"
                  >
                    {code}
                  </span>
                ))}
              </div>
            )
          }
        >
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
