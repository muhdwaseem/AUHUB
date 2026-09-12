import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Lock, Eye, ArrowLeft } from "lucide-react";
import { useFetch } from "../../useApi";
import type { PortalSummary, QualityRow } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Card, ErrorNote, Spinner, Badge, Field, Input, Button, GaugeRing } from "../../components/ui";
import { money, grams, pct, shortDate } from "../../format";

export default function PortalDashboard() {
  // When rendered at /admin/view/:investorId this is set → admin preview mode.
  const { investorId } = useParams();
  const preview = Boolean(investorId);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (investorId) p.set("investorId", investorId);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [from, to, investorId]);

  const { data, loading, error } = useFetch<PortalSummary>(`/portal/summary${qs}`, [qs]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const o = data.overall;
  const inv = data.investor;
  const scoped = Boolean(from || to);

  return (
    <>
      {preview && (
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-warning/30 bg-warning/[0.11] px-4 py-2.5 text-[13px] text-graphite-700">
          <Eye size={15} className="flex-none text-warning" />
          <span>
            Previewing <b className="font-semibold text-graphite-900">{inv.name}</b>’s portal — you’re
            still signed in as admin. This is exactly what {inv.name.split(" ")[0]} sees.
          </span>
          <Link
            to="/admin/investors"
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-graphite-900 underline underline-offset-[3px]"
          >
            <ArrowLeft size={13} /> Back to Investors
          </Link>
        </div>
      )}

      <PageHeader
        title={preview ? `${inv.name}` : "Your account"}
        subtitle={preview ? "Investor portal · admin preview" : `${inv.name} · read-only statement`}
        action={
          <Badge tone="neutral">
            <Lock size={11} className="mr-1" /> Read-only
          </Badge>
        }
      />

      {/* Profile + the focal share donut */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_1.5fr]">
        <Card>
          <div className="p-5 sm:p-6">
            <div className="font-serif text-lg font-semibold text-graphite-900">{inv.name}</div>
            <dl className="mt-5 space-y-3.5 text-sm">
              {inv.teamName && <ProfileRow label="Team" value={inv.teamName} />}
              <ProfileRow label="Profit share" value={pct(inv.sharePercentage)} />
              <ProfileRow label="Capital invested" value={money(inv.capitalInvested)} />
              {inv.companyCutPct > 0 && (
                <ProfileRow
                  label="Company share"
                  value={`${inv.companyCutPct}% of your profit`}
                />
              )}
              <ProfileRow label="Joined" value={shortDate(inv.joinedAt)} />
            </dl>
          </div>
        </Card>

        <div className="flex flex-col items-center gap-5 rounded-xl border border-gold-500/30 bg-gold-500/10 p-5 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.35)] sm:flex-row sm:gap-8 sm:p-6">
          <GaugeRing
            value={inv.sharePercentage}
            size={168}
            strokeWidth={14}
            label="My Share"
          />
          <div className="min-w-0 text-center sm:text-left">
            <div className="text-xs font-medium uppercase tracking-wide text-accent-text">
              My net profit share
            </div>
            <div
              className={`mt-1.5 text-2xl font-bold sm:text-3xl ${
                o.myNetShare >= 0 ? "text-accent-text" : "text-negative"
              }`}
            >
              {money(o.myNetShare)}
            </div>
            <div className="mt-1 text-xs text-accent-text">
              {scoped ? "for the selected dates" : "for the whole book to date"}
            </div>
          </div>
        </div>
      </div>

      {/* How the net share is built */}
      <Card title="Your position" className="mt-6">
        <dl className="divide-y divide-ink-700 text-sm">
          <PositionRow label="My gross profit share" value={money(o.myGrossShare)} />
          <PositionRow
            label={`Less shared expenses (${pct(inv.sharePercentage)} of the pool)`}
            value={`− ${money(o.mySharedExpenseShare)}`}
            muted
          />
          {o.myChargedExpenses > 0 && (
            <PositionRow
              label="Less expenses charged to you"
              value={`− ${money(o.myChargedExpenses)}`}
              muted
            />
          )}
          {o.myCompanyCut > 0 && (
            <PositionRow
              label={`Less company share (${o.companyCutPct}% of your share)`}
              value={`− ${money(o.myCompanyCut)}`}
              muted
            />
          )}
          <PositionRow
            label="My net profit share"
            value={money(o.myNetShare)}
            strong
            tone={o.myNetShare >= 0 ? "accent" : "negative"}
          />
          {o.myNetLossShare > 0 && (
            <PositionRow
              label="My share of the net loss"
              value={money(o.myNetLossShare)}
              tone="negative"
            />
          )}
        </dl>
      </Card>

      {/* How the net share is divided between profit partners */}
      {o.partnerSplit && o.partnerSplit.length > 0 && (
        <Card title="How your share is divided" className="mt-6">
          <dl className="divide-y divide-ink-700 text-sm">
            {o.partnerSplit.map((p, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
                <span className="min-w-0 text-graphite-700">
                  {p.name}
                  {p.role ? ` · ${p.role}` : ""}{" "}
                  <span className="text-graphite-400">{p.percentage}%</span>
                </span>
                <span
                  className={`tnum shrink-0 whitespace-nowrap font-medium ${p.share < 0 ? "text-negative" : "text-accent-text"}`}
                >
                  {money(p.share)}
                </span>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {/* Whole-book context — one compact strip (all losses are visible to every investor) */}
      <Card title="Whole book" className="mt-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-3 sm:gap-x-6 sm:p-5 lg:grid-cols-5">
          <ContextItem
            label="Net profit"
            value={money(o.netProfit)}
            tone={o.netProfit >= 0 ? "positive" : "negative"}
          />
          <ContextItem
            label="Gross profit"
            value={money(o.grossProfit)}
            tone={o.grossProfit >= 0 ? "positive" : "negative"}
          />
          <ContextItem label="Total expenses" value={money(o.totalExpenses)} />
          <ContextItem
            label="Total loss"
            value={o.totalLoss > 0 ? money(o.totalLoss) : "—"}
            tone={o.totalLoss > 0 ? "negative" : "default"}
          />
          <ContextItem
            label="Net loss"
            value={o.netLoss > 0 ? money(o.netLoss) : "—"}
            tone={o.netLoss > 0 ? "negative" : "default"}
          />
        </dl>
      </Card>

      {/* Trading activity — what actually moved: bought, sold, and what's left */}
      <Card title="Trading activity" className="mt-6">
        <dl className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-3 sm:p-5">
          <ContextItem
            label="Purchases"
            value={grams(o.goldBoughtGrams)}
            sub={money(o.goldBoughtValue)}
          />
          <ContextItem
            label="Sales"
            value={grams(o.goldSoldGrams)}
            sub={money(o.goldSoldValue)}
          />
          <ContextItem
            label="Stock on hand"
            value={grams(o.stockLeftGrams)}
            sub={money(o.stockLeftValue)}
          />
        </dl>
        {(o.buyByQuality.length > 0 || o.sellByQuality.length > 0) && (
          <div className="grid grid-cols-1 gap-4 border-t border-ink-700 p-4 sm:grid-cols-2 sm:p-5">
            <QualityBreakdown title="Bought by quality" rows={o.buyByQuality} />
            <QualityBreakdown title="Sold by quality" rows={o.sellByQuality} />
          </div>
        )}
      </Card>

      {/* Daily statement */}
      <Card title="Daily statement" className="mt-6" variant="flat">
        <div className="flex flex-col items-stretch gap-3 border-b border-ink-700 p-4 sm:flex-row sm:flex-wrap sm:items-end">
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
        {/* mobile: card per day */}
        <div className="divide-y divide-ink-700 sm:hidden">
          {data.daily.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-graphite-400">
              No activity in this period yet.
            </p>
          )}
          {data.daily.map((d) => (
            <div key={d.date!} className="px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium text-graphite-700">{shortDate(d.date)}</span>
                <span
                  className={`tnum font-semibold ${d.myNetShare >= 0 ? "text-accent-text" : "text-negative"}`}
                >
                  {money(d.myNetShare)}
                  <span className="ml-1 text-[10px] font-normal text-graphite-400">my share</span>
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-graphite-500">
                <span>
                  Bought <b className="tnum text-graphite-700">{grams(d.goldBoughtGrams)}</b>
                </span>
                <span>
                  Sold <b className="tnum text-graphite-700">{grams(d.goldSoldGrams)}</b>
                </span>
                <span>
                  Book net{" "}
                  <b className={`tnum ${d.netProfit >= 0 ? "text-graphite-700" : "text-negative"}`}>
                    {money(d.netProfit)}
                  </b>
                </span>
                {d.netLoss > 0 && (
                  <span>
                    Book loss <b className="tnum text-negative">{money(d.netLoss)}</b>
                  </span>
                )}
                {d.myNetLossShare > 0 && (
                  <span>
                    My loss share <b className="tnum text-negative">{money(d.myNetLossShare)}</b>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Bought</th>
                <th className="px-4 py-2.5 text-right font-medium">Sold</th>
                <th className="px-4 py-2.5 text-right font-medium">Net profit (book)</th>
                <th className="px-4 py-2.5 text-right font-medium">My share</th>
                <th className="px-4 py-2.5 text-right font-medium">Net loss (book)</th>
                <th className="px-4 py-2.5 text-right font-medium">My loss share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700">
              {data.daily.map((d) => (
                <tr key={d.date!} className="hover:bg-ink-900/60">
                  <td className="px-5 py-2.5 font-medium text-graphite-700">{shortDate(d.date)}</td>
                  <td className="px-4 py-2.5 text-right tnum text-graphite-600">{grams(d.goldBoughtGrams)}</td>
                  <td className="px-4 py-2.5 text-right tnum text-graphite-600">{grams(d.goldSoldGrams)}</td>
                  <td
                    className={`px-4 py-2.5 text-right tnum ${
                      d.netProfit >= 0 ? "" : "text-negative"
                    }`}
                  >
                    {money(d.netProfit)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right tnum font-medium ${
                      d.myNetShare >= 0 ? "text-accent-text" : "text-negative"
                    }`}
                  >
                    {money(d.myNetShare)}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-negative">
                    {d.netLoss > 0 ? money(d.netLoss) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tnum text-negative">
                    {d.myNetLossShare > 0 ? money(d.myNetLossShare) : "—"}
                  </td>
                </tr>
              ))}
              {data.daily.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-graphite-400">
                    No activity in this period yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-6 text-xs text-graphite-400">
        Your net share = (gross profit − shared expenses) × {pct(inv.sharePercentage)} − any
        expenses charged directly to you. Other investors’ shares are private; all losses are
        shown to every investor. Generated {shortDate(data.generatedAt)}.
      </p>
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 text-graphite-500">{label}</dt>
      <dd className="shrink-0 whitespace-nowrap font-medium text-graphite-900">{value}</dd>
    </div>
  );
}

function PositionRow({
  label,
  value,
  muted = false,
  strong = false,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  muted?: boolean;
  strong?: boolean;
  tone?: "default" | "accent" | "negative";
}) {
  const toneCls =
    tone === "accent" ? "text-accent-text" : tone === "negative" ? "text-negative" : "text-graphite-900";
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-3 sm:px-5">
      <dt className={`min-w-0 ${strong ? "font-semibold text-graphite-900" : "text-graphite-600"}`}>
        {label}
      </dt>
      <dd className={`tnum shrink-0 whitespace-nowrap ${strong ? "text-base font-semibold" : "font-medium"} ${muted ? "text-graphite-500" : toneCls}`}>
        {value}
      </dd>
    </div>
  );
}

function ContextItem({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  const toneCls =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-graphite-900";
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-graphite-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${toneCls}`}>{value}</dd>
      {sub && <div className="mt-0.5 text-xs text-graphite-500">{sub}</div>}
    </div>
  );
}

function QualityBreakdown({ title, rows }: { title: string; rows: QualityRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-graphite-500">{title}</div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.quality} className="flex items-baseline justify-between gap-3 text-[12.5px]">
            <span className="min-w-0 font-medium text-graphite-700">{r.quality}</span>
            <span className="tnum shrink-0 whitespace-nowrap text-graphite-500">
              {grams(r.grams)} <span className="text-graphite-700">{money(r.value)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
