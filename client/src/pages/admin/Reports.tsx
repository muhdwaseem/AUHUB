import { Fragment, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { ReportSummary } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Button, Card, ErrorNote, Field, Input, Spinner, Stat } from "../../components/ui";
import { money, grams, pct, shortDate } from "../../format";

export default function Reports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  const { data, loading, error } = useFetch<ReportSummary>(`/reports/summary${qs}`, [qs]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  function exportCsv() {
    if (!data) return;
    const rows = [
      [
        "Date",
        "Gold bought (g)",
        "Bought value",
        "Gold sold (g)",
        "Sold value",
        "Stock left (g)",
        "Gross profit",
        "Expenses",
        "Net profit",
        "Total loss",
        "Net loss",
      ],
      ...data.daily.map((d) => [
        d.date,
        d.goldBoughtGrams,
        d.goldBoughtValue,
        d.goldSoldGrams,
        d.goldSoldValue,
        d.stockLeftGrams,
        d.grossProfit,
        d.totalExpenses,
        d.netProfit,
        d.totalLoss,
        d.netLoss,
      ]),
      [],
      [
        "OVERALL",
        data.overall.goldBoughtGrams,
        data.overall.goldBoughtValue,
        data.overall.goldSoldGrams,
        data.overall.goldSoldValue,
        data.overall.stockLeftGrams,
        data.overall.grossProfit,
        data.overall.totalExpenses,
        data.overall.netProfit,
        data.overall.totalLoss,
        data.overall.netLoss,
      ],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crmgold-report-${from || "start"}_${to || "now"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const o = data.overall;

  return (
    <>
      <PageHeader
        title="Profit & Loss"
        subtitle="Daily accounts and the overall book, with each investor’s share."
        action={
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      {/* Overall */}
      <h2 className="mb-3 text-sm font-semibold text-graphite-700">
        Overall {from || to ? "(filtered range)" : "(all time)"}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Net Profit" value={money(o.netProfit)} tone={o.netProfit >= 0 ? "positive" : "negative"} />
        <Stat label="Gross Profit" value={money(o.grossProfit)} tone={o.grossProfit >= 0 ? "positive" : "negative"} />
        <Stat label="Total Expenses" value={money(o.totalExpenses)} tone="negative" />
        <Stat label="Net Loss" value={money(o.netLoss)} tone={o.netLoss > 0 ? "negative" : "default"} />
        <Stat label="Gold Bought" value={grams(o.goldBoughtGrams)} sub={money(o.goldBoughtValue)} />
        <Stat label="Gold Sold" value={grams(o.goldSoldGrams)} sub={money(o.goldSoldValue)} />
        <Stat label="Stock Left" value={grams(o.stockLeftGrams)} sub={money(o.stockLeftValue)} tone="gold" />
        <Stat label="Total Loss (gross)" value={money(o.totalLoss)} tone={o.totalLoss > 0 ? "negative" : "default"} />
      </div>

      {/* Investor split */}
      <Card title="Profit split by investor (overall)" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Investor</th>
                <th className="px-4 py-2.5 text-right font-medium">Share</th>
                <th className="px-4 py-2.5 text-right font-medium">Gross share</th>
                <th className="px-4 py-2.5 text-right font-medium">Shared exp.</th>
                <th className="px-4 py-2.5 text-right font-medium">Charged to them</th>
                <th className="px-4 py-2.5 text-right font-medium">Net share</th>
                <th className="px-4 py-2.5 text-right font-medium">Net loss share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-50">
              {data.investorSplit.map((s) => (
                <tr key={s.investorId}>
                  <td className="px-5 py-3 font-medium text-graphite-700">{s.name}</td>
                  <td className="px-4 py-3 text-right tnum text-accent-text">{pct(s.sharePercentage)}</td>
                  <td className="px-4 py-3 text-right tnum">{money(s.grossShare)}</td>
                  <td className="px-4 py-3 text-right tnum text-graphite-500">
                    −{money(s.sharedExpenseShare)}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-warning">
                    {s.chargedExpenses > 0 ? `−${money(s.chargedExpenses)}` : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right tnum font-medium ${s.netShare >= 0 ? "text-positive" : "text-negative"}`}>
                    {money(s.netShare)}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-negative">
                    {s.netLossShare > 0 ? money(s.netLossShare) : "—"}
                  </td>
                </tr>
              ))}
              {data.investorSplit.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-graphite-400">
                    No active investors
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-graphite-100 px-5 py-2.5 text-xs text-graphite-400">
          Net share = (gross profit − shared expenses) × their % − expenses charged
          directly to them.
        </p>
      </Card>

      {/* Expenses by investor */}
      {data.expensesByInvestor.length > 0 && (
        <Card title="Expenses tied to investors" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                  <th className="px-5 py-2.5 font-medium">Investor</th>
                  <th className="px-4 py-2.5 text-right font-medium">Charged to them</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tagged only (still shared)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-50">
                {data.expensesByInvestor.map((r) => (
                  <tr key={r.name}>
                    <td className="px-5 py-2.5 text-graphite-600">{r.name}</td>
                    <td className="px-4 py-2.5 text-right tnum font-medium text-warning">
                      {r.charged > 0 ? money(r.charged) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right tnum text-graphite-500">
                      {r.tagged > 0 ? money(r.tagged) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Expenses by category */}
      {data.expensesByCategory.length > 0 && (
        <Card title="Expenses by header" className="mt-6">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-graphite-50">
              {data.expensesByCategory.map((c) => (
                <tr key={c.name}>
                  <td className="px-5 py-2.5 text-graphite-600">{c.name}</td>
                  <td className="px-5 py-2.5 text-right tnum font-medium">{money(c.amount)}</td>
                </tr>
              ))}
              <tr className="bg-graphite-50">
                <td className="px-5 py-2.5 font-semibold text-graphite-700">Total</td>
                <td className="px-5 py-2.5 text-right tnum font-semibold">
                  {money(o.totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* Daily accounts */}
      <Card title="Daily accounts" className="mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Bought</th>
                <th className="px-4 py-2.5 text-right font-medium">Sold</th>
                <th className="px-4 py-2.5 text-right font-medium">Stock left</th>
                <th className="px-4 py-2.5 text-right font-medium">Gross</th>
                <th className="px-4 py-2.5 text-right font-medium">Expenses</th>
                <th className="px-4 py-2.5 text-right font-medium">Net profit</th>
                <th className="px-4 py-2.5 text-right font-medium">Net loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-50">
              {data.daily.map((d) => {
                const split = data.dailyInvestorSplit.find((x) => x.date === d.date);
                const isOpen = expandedDay === d.date;
                return (
                  <Fragment key={d.date!}>
                    <tr
                      onClick={() => setExpandedDay(isOpen ? null : d.date)}
                      className="cursor-pointer hover:bg-graphite-50/60"
                    >
                      <td className="px-5 py-2.5 font-medium text-graphite-700">
                        {shortDate(d.date)}
                      </td>
                      <td className="px-4 py-2.5 text-right tnum">{grams(d.goldBoughtGrams)}</td>
                      <td className="px-4 py-2.5 text-right tnum">{grams(d.goldSoldGrams)}</td>
                      <td className="px-4 py-2.5 text-right tnum text-accent-text">
                        {grams(d.stockLeftGrams)}
                      </td>
                      <td className={`px-4 py-2.5 text-right tnum ${d.grossProfit >= 0 ? "" : "text-negative"}`}>
                        {money(d.grossProfit)}
                      </td>
                      <td className="px-4 py-2.5 text-right tnum text-graphite-500">
                        {money(d.totalExpenses)}
                      </td>
                      <td className={`px-4 py-2.5 text-right tnum font-medium ${d.netProfit >= 0 ? "text-positive" : "text-negative"}`}>
                        {money(d.netProfit)}
                      </td>
                      <td className="px-4 py-2.5 text-right tnum text-negative">
                        {d.netLoss > 0 ? money(d.netLoss) : "—"}
                      </td>
                    </tr>
                    {isOpen && split && (
                      <tr className="bg-graphite-50/70">
                        <td colSpan={8} className="px-5 py-3">
                          <div className="text-xs font-medium text-graphite-500">
                            Investor split for {shortDate(d.date)}
                          </div>
                          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                            {split.rows.map((r) => (
                              <div
                                key={r.investorId}
                                className="flex items-center justify-between rounded-md bg-ink-900 px-3 py-1.5 text-sm"
                              >
                                <span className="text-graphite-600">
                                  {r.name} · {pct(r.sharePercentage)}
                                </span>
                                <span
                                  className={`tnum font-medium ${r.netShare >= 0 ? "text-positive" : "text-negative"}`}
                                >
                                  {money(r.netShare)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {data.daily.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-graphite-400">
                    No activity in this range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-6 text-xs text-graphite-400">
        Cost basis: weighted-average purchase rate ({money(o.avgBuyRate)}/g). Click a day
        to see its investor split. Generated {shortDate(data.generatedAt)}.
      </p>
    </>
  );
}
