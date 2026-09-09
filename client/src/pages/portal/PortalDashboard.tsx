import { useMemo, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useFetch } from "../../useApi";
import type { PortalSummary } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Card, ErrorNote, Spinner, Badge, Field, Input, Button, GaugeRing } from "../../components/ui";
import { money, grams, pct, shortDate } from "../../format";

export default function PortalDashboard() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  const { data, loading, error } = useFetch<PortalSummary>(`/portal/summary${qs}`, [qs]);

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!data) return null;

  const o = data.overall;
  const inv = data.investor;
  const scoped = Boolean(from || to);

  return (
    <>
      <PageHeader
        title="Your account"
        subtitle={`${inv.name} · read-only statement`}
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
              <ProfileRow label="Profit share" value={pct(inv.sharePercentage)} />
              <ProfileRow label="Capital invested" value={money(inv.capitalInvested)} />
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

      {/* Whole-book context — one compact strip (all losses are visible to every investor) */}
      <Card title="Whole book" className="mt-6">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-3 sm:gap-x-6 sm:p-5 lg:grid-cols-6">
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
          <ContextItem label="Stock on hand" value={grams(o.stockLeftGrams)} />
        </dl>
      </Card>

      {/* Daily statement */}
      <Card title="Daily statement" className="mt-6">
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Date</th>
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
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-graphite-400">
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
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-graphite-500">{label}</dt>
      <dd className="font-medium text-graphite-900">{value}</dd>
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
    <div className="flex items-baseline justify-between gap-4 px-5 py-3">
      <dt className={`${strong ? "font-semibold text-graphite-900" : "text-graphite-600"}`}>
        {label}
      </dt>
      <dd className={`tnum ${strong ? "text-base font-semibold" : "font-medium"} ${muted ? "text-graphite-500" : toneCls}`}>
        {value}
      </dd>
    </div>
  );
}

function ContextItem({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "positive" | "negative";
}) {
  const toneCls =
    tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-graphite-900";
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-graphite-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold ${toneCls}`}>{value}</dd>
    </div>
  );
}
