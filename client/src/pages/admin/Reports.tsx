import { Fragment, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { ReportSummary } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Button, Card, ErrorNote, Field, Input, Spinner, Stat } from "../../components/ui";
import { money, grams, pct, shortDate } from "../../format";
import { useTeam } from "../../team";

export default function Reports() {
  const { activeTeamId, activeTeam } = useTeam();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (activeTeamId) p.set("teamId", activeTeamId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [from, to, activeTeamId]);

  const { data, loading, error } = useFetch<ReportSummary>(
    activeTeamId ? `/reports/summary${qs}` : null,
    [qs]
  );
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

  if (!activeTeamId) return <ErrorNote>Select a team first.</ErrorNote>;
  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const o = data.overall;

  return (
    <>
      <PageHeader
        title="Profit & Loss"
        subtitle={`${activeTeam?.name ?? data.teamName ?? "This team"} · daily accounts and the overall book, with each member's share.`}
        action={
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={16} /> Export CSV
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
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

      {/* How the profit is calculated */}
      <Card title="How the profit is divided" className="mt-6">
        <div className="space-y-1.5 p-4 text-[13px]">
          <div className="flex justify-between">
            <span className="text-graphite-600">Gross profit (sale value − cost of gold sold)</span>
            <span className={`tnum ${o.grossProfit >= 0 ? "" : "text-negative"}`}>{money(o.grossProfit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-graphite-600">− Shared expenses (from the common pool)</span>
            <span className="tnum text-graphite-500">−{money(o.sharedExpenses)}</span>
          </div>
          <div className="flex justify-between border-t border-graphite-100 pt-1.5 font-semibold">
            <span className="text-graphite-800">= Common net pool (split by investor %)</span>
            <span className={`tnum ${o.commonNetProfit >= 0 ? "text-positive" : "text-negative"}`}>
              {money(o.commonNetProfit)}
            </span>
          </div>
          {data.companyEarnings > 0 && (
            <div className="flex justify-between">
              <span className="text-graphite-600">− Company cut (across all members)</span>
              <span className="tnum text-graphite-500">−{money(data.companyEarnings)}</span>
            </div>
          )}
          <p className="pt-1.5 text-[12px] leading-relaxed text-graphite-400">
            Each member’s share = common net pool × their % − expenses charged to them. The{" "}
            <b className="font-semibold text-graphite-600">company</b> then takes its % of that
            (only when it’s a profit), and whatever is left is divided again by the member’s{" "}
            <b className="font-semibold text-graphite-600">profit partners</b> (shown indented
            below).
          </p>
        </div>
      </Card>

      {/* Investor split */}
      <Card title="Profit split by investor (overall)" className="mt-6">
        {/* mobile: card per investor */}
        <div className="divide-y divide-graphite-50 sm:hidden">
          {data.investorSplit.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-graphite-400">No active investors</p>
          )}
          {data.investorSplit.map((s) => (
            <div key={s.investorId} className="px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-graphite-800">{s.name}</span>
                <span className="tnum text-[11px] text-accent-text">{pct(s.sharePercentage)} share</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <div>
                  <span className="text-graphite-400">Gross </span>
                  <b className="tnum">{money(s.grossShare)}</b>
                </div>
                <div className="text-right">
                  <span className="text-graphite-400">Shared exp. </span>
                  <b className="tnum text-graphite-500">−{money(s.sharedExpenseShare)}</b>
                </div>
                {s.chargedExpenses > 0 && (
                  <div className="col-span-2">
                    <span className="text-graphite-400">Charged to them </span>
                    <b className="tnum text-warning">−{money(s.chargedExpenses)}</b>
                  </div>
                )}
                {s.companyCut > 0 && (
                  <div className="col-span-2">
                    <span className="text-graphite-400">Company cut ({s.companyCutPct}%) </span>
                    <b className="tnum text-graphite-500">−{money(s.companyCut)}</b>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between border-t border-graphite-100 pt-1.5">
                <span className="text-[11px] uppercase tracking-wide text-graphite-400">Net share</span>
                <span className={`tnum font-semibold ${s.netShare >= 0 ? "text-positive" : "text-negative"}`}>
                  {money(s.netShare)}
                </span>
              </div>
              {s.netLossShare > 0 && (
                <div className="mt-1 flex items-baseline justify-between text-[12px]">
                  <span className="text-graphite-400">Net loss share</span>
                  <span className="tnum text-negative">{money(s.netLossShare)}</span>
                </div>
              )}
              {s.partnerSplit.length > 0 && (
                <div className="mt-1.5 space-y-0.5 border-t border-graphite-100 pt-1.5 text-[11.5px]">
                  {s.partnerSplit.map((p, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-2 text-graphite-400">
                      <span className="truncate">
                        ↳ {p.name}
                        {p.role ? ` · ${p.role}` : ""}{" "}
                        <span className="text-graphite-500">{p.percentage}%</span>
                      </span>
                      <span className={`tnum ${p.share < 0 ? "text-negative" : "text-graphite-600"}`}>
                        {money(p.share)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Investor</th>
                <th className="px-4 py-2.5 text-right font-medium">Share</th>
                <th className="px-4 py-2.5 text-right font-medium">Gross share</th>
                <th className="px-4 py-2.5 text-right font-medium">Shared exp.</th>
                <th className="px-4 py-2.5 text-right font-medium">Charged to them</th>
                <th className="px-4 py-2.5 text-right font-medium">Company cut</th>
                <th className="px-4 py-2.5 text-right font-medium">Net share</th>
                <th className="px-4 py-2.5 text-right font-medium">Net loss share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-50">
              {data.investorSplit.map((s) => (
                <Fragment key={s.investorId}>
                  <tr>
                    <td className="px-5 py-3 font-medium text-graphite-700">{s.name}</td>
                    <td className="px-4 py-3 text-right tnum text-accent-text">{pct(s.sharePercentage)}</td>
                    <td className="px-4 py-3 text-right tnum">{money(s.grossShare)}</td>
                    <td className="px-4 py-3 text-right tnum text-graphite-500">
                      −{money(s.sharedExpenseShare)}
                    </td>
                    <td className="px-4 py-3 text-right tnum text-warning">
                      {s.chargedExpenses > 0 ? `−${money(s.chargedExpenses)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right tnum text-graphite-500">
                      {s.companyCut > 0 ? `−${money(s.companyCut)} (${s.companyCutPct}%)` : "—"}
                    </td>
                    <td className={`px-4 py-3 text-right tnum font-medium ${s.netShare >= 0 ? "text-positive" : "text-negative"}`}>
                      {money(s.netShare)}
                    </td>
                    <td className="px-4 py-3 text-right tnum text-negative">
                      {s.netLossShare > 0 ? money(s.netLossShare) : "—"}
                    </td>
                  </tr>
                  {s.partnerSplit.map((p, i) => (
                    <tr key={i} className="bg-graphite-50/50 text-[12.5px]">
                      <td className="py-2 pl-9 pr-5 text-graphite-500" colSpan={6}>
                        ↳ {p.name}
                        {p.role ? ` · ${p.role}` : ""}{" "}
                        <span className="text-graphite-400">{p.percentage}%</span>
                      </td>
                      <td className={`px-4 py-2 text-right tnum ${p.share < 0 ? "text-negative" : "text-graphite-700"}`}>
                        {money(p.share)}
                      </td>
                      <td className="px-4 py-2" />
                    </tr>
                  ))}
                </Fragment>
              ))}
              {data.investorSplit.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-graphite-400">
                    No active investors
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-graphite-100 px-5 py-2.5 text-xs text-graphite-400">
          Net share = (gross profit − shared expenses) × their % − expenses charged directly to
          them − the company cut (taken only on a profit). Profit partners then divide the net
          share.
        </p>
      </Card>

      {/* Expenses by investor */}
      {data.expensesByInvestor.length > 0 && (
        <Card title="Expenses tied to investors" className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                  <th className="px-3 py-2.5 sm:px-5 font-medium">Investor</th>
                  <th className="px-2.5 py-2.5 text-right font-medium sm:px-4">Charged</th>
                  <th className="px-2.5 py-2.5 text-right font-medium sm:px-4">Tagged (shared)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite-50">
                {data.expensesByInvestor.map((r) => (
                  <tr key={r.name}>
                    <td className="px-3 py-2.5 text-graphite-600 sm:px-5">{r.name}</td>
                    <td className="px-2.5 py-2.5 text-right tnum font-medium text-warning sm:px-4">
                      {r.charged > 0 ? money(r.charged) : "—"}
                    </td>
                    <td className="px-2.5 py-2.5 text-right tnum text-graphite-500 sm:px-4">
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
                  <td className="px-3 py-2.5 sm:px-5 text-graphite-600">{c.name}</td>
                  <td className="px-3 py-2.5 sm:px-5 text-right tnum font-medium">{money(c.amount)}</td>
                </tr>
              ))}
              <tr className="bg-graphite-50">
                <td className="px-3 py-2.5 sm:px-5 font-semibold text-graphite-700">Total</td>
                <td className="px-3 py-2.5 sm:px-5 text-right tnum font-semibold">
                  {money(o.totalExpenses)}
                </td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}

      {/* Daily accounts */}
      <Card title="Daily accounts" className="mt-6">
        {/* mobile: card per day, tap to expand the investor split */}
        <div className="divide-y divide-graphite-50 sm:hidden">
          {data.daily.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-graphite-400">No activity in this range</p>
          )}
          {data.daily.map((d) => {
            const split = data.dailyInvestorSplit.find((x) => x.date === d.date);
            const isOpen = expandedDay === d.date;
            return (
              <div key={d.date!} className="px-3.5 py-3">
                <button
                  onClick={() => setExpandedDay(isOpen ? null : d.date)}
                  className="flex w-full items-baseline justify-between gap-2 text-left"
                >
                  <span className="font-medium text-graphite-700">{shortDate(d.date)}</span>
                  <span className={`tnum font-semibold ${d.netProfit >= 0 ? "text-positive" : "text-negative"}`}>
                    {money(d.netProfit)}
                  </span>
                </button>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11.5px] text-graphite-500 sm:grid-cols-3">
                  <span>Bought <b className="tnum text-graphite-700">{grams(d.goldBoughtGrams)}</b></span>
                  <span>Sold <b className="tnum text-graphite-700">{grams(d.goldSoldGrams)}</b></span>
                  <span>Stock <b className="tnum text-accent-text">{grams(d.stockLeftGrams)}</b></span>
                  <span>Gross <b className="tnum text-graphite-700">{money(d.grossProfit)}</b></span>
                  <span>Exp. <b className="tnum text-graphite-700">{money(d.totalExpenses)}</b></span>
                  {d.netLoss > 0 && (
                    <span>Net loss <b className="tnum text-negative">{money(d.netLoss)}</b></span>
                  )}
                </div>
                {isOpen && split && (
                  <div className="mt-2 space-y-1.5 border-t border-graphite-100 pt-2">
                    {split.rows.map((r) => (
                      <div
                        key={r.investorId}
                        className="flex items-center justify-between rounded-md bg-ink-900 px-3 py-1.5 text-[12.5px]"
                      >
                        <span className="text-graphite-600">{r.name} · {pct(r.sharePercentage)}</span>
                        <span className={`tnum font-medium ${r.netShare >= 0 ? "text-positive" : "text-negative"}`}>
                          {money(r.netShare)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
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
