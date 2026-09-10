import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, Search } from "lucide-react";
import { useFetch } from "../../useApi";
import type { ReportSummary, GoldTxn } from "../../types";
import { PageHeader, Dot } from "../../components/AppShell";
import { Spinner, ErrorNote } from "../../components/ui";
import { WorldMap } from "../../components/WorldMap";
import { money, grams, num, pct, shortDate } from "../../format";
import { useTeam } from "../../team";

/* ── tile shell (frosted glass) ── */
function Tile({ area, className = "", children }: { area: string; className?: string; children: ReactNode }) {
  return (
    <section
      className={`glass a-${area} flex min-w-0 flex-col rounded-[20px] border border-graphite-200 bg-ink-800 p-3.5 sm:p-[18px] ${className}`}
    >
      <div className="relative z-[1] flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
function TileHead({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
      <h2 className="m-0 font-serif text-[15px] font-semibold -tracking-[0.01em] text-graphite-900">{title}</h2>
      {right && <span className="text-[11px] text-graphite-500">{right}</span>}
    </div>
  );
}
function Kicker({ children }: { children: ReactNode }) {
  return (
    <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-graphite-500">{children}</div>
  );
}
function Chip({ tone, children }: { tone: "pos" | "neg" | "gold"; children: ReactNode }) {
  const map = {
    pos: "bg-positive/12 text-positive",
    neg: "bg-negative/12 text-negative",
    gold: "bg-warning/12 text-gold-500",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] font-mono text-[10.5px] font-semibold tracking-[0.02em] ${map[tone]}`}
    >
      {children}
    </span>
  );
}

const goldStroke = "var(--color-gold-500)";

/* ── sold-through gauge (270° arc, glow bloom + end-cap dot) ── */
function Gauge({ pctValue }: { pctValue: number }) {
  const r = 76;
  const circ = 2 * Math.PI * r; // 477.52
  const span = circ * 0.75; // 358.14 — 270° track
  const p = Math.max(0, Math.min(100, pctValue)) / 100;
  const val = span * p;
  // end-cap position: start at 135° (top-left), sweep clockwise by (p * 270°)
  const angle = (135 + p * 270) * (Math.PI / 180);
  const ex = 100 + r * Math.cos(angle);
  const ey = 100 + r * Math.sin(angle);
  return (
    <div className="relative mx-auto mt-0.5 w-full max-w-[212px]">
      <svg viewBox="0 0 200 200" className="block h-auto w-full">
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-gold-lo)" />
            <stop offset="55%" stopColor="var(--color-gold-500)" />
            <stop offset="100%" stopColor="var(--color-gold-hi)" />
          </linearGradient>
          <filter id="gaugeGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform="rotate(135 100 100)">
          <circle
            cx="100" cy="100" r={r} fill="none" stroke="var(--color-ink-700)"
            strokeWidth="15" strokeLinecap="round" strokeDasharray={`${span} ${circ}`}
          />
          <circle
            cx="100" cy="100" r={r} fill="none" stroke="url(#gaugeGrad)"
            strokeWidth="15" strokeLinecap="round" strokeDasharray={`${val} ${circ}`}
            filter="url(#gaugeGlow)" opacity="0.55"
          />
          <circle
            cx="100" cy="100" r={r} fill="none" stroke="url(#gaugeGrad)"
            strokeWidth="15" strokeLinecap="round" strokeDasharray={`${val} ${circ}`}
          />
        </g>
        {p > 0.02 && (
          <>
            <circle cx={ex} cy={ey} r="14" fill="var(--color-gold-500)" opacity="0.14" />
            <circle cx={ex} cy={ey} r="7" fill="var(--color-ink-800)" stroke="var(--color-gold-hi)" strokeWidth="3" />
          </>
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center gap-0.5 text-center">
        <div className="font-serif text-[38px] font-semibold leading-none -tracking-[0.03em] text-graphite-900">
          {pctValue.toFixed(1)}
          <span className="text-[18px] text-graphite-500">%</span>
        </div>
        <Kicker>Sold through</Kicker>
      </div>
    </div>
  );
}

/* ── investor split ring (stacked segments) ── */
function SplitRing({ segments, centre, label }: { segments: number[]; centre: string; label: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const shades = ["var(--color-gold-hi)", "var(--color-gold-500)", "var(--color-gold-lo)", "var(--color-gold-400)"];
  let acc = 0;
  return (
    <div className="relative h-[104px] w-[104px] flex-none">
      <svg width="104" height="104" viewBox="0 0 104 104" className="block -rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--color-ink-700)" strokeWidth="13" />
        {segments.map((seg, i) => {
          const len = circ * (seg / 100);
          const off = -circ * (acc / 100);
          acc += seg;
          return (
            <circle
              key={i} cx="52" cy="52" r={r} fill="none"
              stroke={shades[i % shades.length]} strokeWidth="13"
              strokeDasharray={`${len} ${circ}`} strokeDashoffset={off}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <b className="font-serif text-[21px] font-semibold leading-none text-warning">{centre}</b>
        <span className="mt-1 block text-[8px] uppercase tracking-[0.15em] text-graphite-500">{label}</span>
      </div>
    </div>
  );
}

/* ── per-ticket value bars (SVG, rounded pills) ── */
function TicketBars({ tickets, max }: { tickets: GoldTxn[]; max: number }) {
  const W = 380;
  const H = 208;
  const base = 170; // baseline
  const top = 22;
  const plotH = base - top;
  const barW = 28;
  const slot = tickets.length > 0 ? (W - 30 - barW) / Math.max(1, tickets.length - 1) : 58;

  return (
    <div className="flex flex-1 items-end overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[340px]" role="img" aria-label="Trade tickets by value">
        <defs>
          <linearGradient id="buyBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--color-gold-lo)" />
            <stop offset="100%" stopColor="var(--color-gold-500)" />
          </linearGradient>
          <linearGradient id="sellBar" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--color-gold-500)" />
            <stop offset="100%" stopColor="var(--color-gold-hi)" />
          </linearGradient>
        </defs>
        {[28, 75, 122].map((y) => (
          <line key={y} x1="14" y1={y} x2={W - 8} y2={y} stroke="var(--color-graphite-100)" strokeWidth="1" />
        ))}
        <line x1="14" y1={base} x2={W - 8} y2={base} stroke="var(--color-graphite-200)" strokeWidth="1" strokeDasharray="3 4" />
        {tickets.map((t, i) => {
          const bh = Math.max((t.totalAmount / max) * plotH, 6);
          const x = 30 + i * slot;
          const y = base - bh;
          return (
            <g key={t.id}>
              <rect x={x} y={y} width={barW} height={bh} rx="14" fill={t.type === "BUY" ? "url(#buyBar)" : "url(#sellBar)"} />
              <text
                x={x + barW / 2} y={y - 8} textAnchor="middle"
                className="fill-[var(--color-graphite-700)] font-mono text-[9.5px]"
              >
                {(t.totalAmount / 1000).toFixed(1)}
              </text>
              <text
                x={x + barW / 2} y={188} textAnchor="middle"
                className="fill-[var(--color-graphite-500)] font-mono text-[9.5px]"
              >
                {new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
              </text>
            </g>
          );
        })}
        <circle cx="20" cy="202" r="4" fill="url(#buyBar)" />
        <text x="29" y="205" className="fill-[var(--color-graphite-500)] font-mono text-[9.5px]">Buy</text>
        <circle cx="72" cy="202" r="4" fill="url(#sellBar)" />
        <text x="81" y="205" className="fill-[var(--color-graphite-500)] font-mono text-[9.5px]">Sell</text>
      </svg>
    </div>
  );
}

/* ── cumulative profit trend ── */
function TrendChart({ daily }: { daily: ReportSummary["daily"] }) {
  const dated = daily.filter((d) => d.date);
  if (dated.length < 2)
    return (
      <div className="flex flex-1 items-center justify-center py-10 text-[13px] text-graphite-500">
        Not enough dated activity to chart yet.
      </div>
    );

  let cn = 0;
  let cg = 0;
  const pts = dated.map((d) => {
    cn += d.netProfit;
    cg += d.grossProfit;
    return { date: d.date as string, net: cn, gross: cg };
  });

  const W = 660;
  const H = 250;
  const x0 = 46;
  const x1 = W - 48;
  const y0 = 20;
  const y1 = H - 38;
  const vals = pts.flatMap((p) => [p.net, p.gross]).concat(0);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.12, 1);
  const dLo = lo - pad;
  const dHi = hi + pad;
  const sx = (i: number) => x0 + (i / (pts.length - 1)) * (x1 - x0);
  const sy = (v: number) => y0 + ((dHi - v) / (dHi - dLo)) * (y1 - y0);
  const zeroY = sy(0);

  const netLine = pts.map((p, i) => `${sx(i)},${sy(p.net)}`).join(" ");
  const grossLine = pts.map((p, i) => `${sx(i)},${sy(p.gross)}`).join(" ");
  const netArea = `${x0},${zeroY} ${netLine} ${x1},${zeroY}`;
  const last = pts[pts.length - 1];

  const ticks = 4;
  return (
    <div className="flex-1 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[460px]" role="img" aria-label="Cumulative gross and net profit over time">
        <defs>
          <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={goldStroke} stopOpacity="0.3" />
            <stop offset="100%" stopColor={goldStroke} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = dHi - (i / ticks) * (dHi - dLo);
          const y = sy(v);
          const isZero = Math.abs(v) < (dHi - dLo) / 200;
          return (
            <g key={i}>
              <line
                x1={x0} y1={y} x2={x1} y2={y}
                stroke={isZero ? "var(--color-ink-600)" : "var(--color-ink-700)"}
                strokeWidth="1" strokeDasharray={isZero ? "3 4" : undefined}
              />
              <text x={x0 - 8} y={y + 3} textAnchor="end" className="fill-[var(--color-graphite-500)] font-mono text-[9.5px]">
                {new Intl.NumberFormat("en", { notation: "compact" }).format(Math.round(v))}
              </text>
            </g>
          );
        })}
        <polygon fill="url(#netFill)" points={netArea} />
        <polyline
          fill="none" stroke="var(--color-graphite-600)" strokeWidth="1.6"
          strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" opacity="0.7"
          points={grossLine}
        />
        <polyline
          fill="none" stroke={goldStroke} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
          points={netLine}
        />
        <circle cx={sx(pts.length - 1)} cy={sy(last.gross)} r="3.4" fill="var(--color-graphite-600)" />
        <circle cx={sx(pts.length - 1)} cy={sy(last.net)} r="5" fill={goldStroke} />
        <circle cx={sx(pts.length - 1)} cy={sy(last.net)} r="10" fill={goldStroke} opacity="0.18" />
        {pts.map((p, i) => (
          <text
            key={i} x={sx(i)} y={H - 8} textAnchor="middle"
            className="fill-[var(--color-graphite-500)] font-mono text-[9.5px]"
          >
            {new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: i === 0 ? "short" : undefined })}
          </text>
        ))}
      </svg>
    </div>
  );
}

export default function Dashboard() {
  const { activeTeamId } = useTeam();
  const { data: s, loading, error } = useFetch<ReportSummary>(
    activeTeamId ? `/reports/summary?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );
  const { data: g } = useFetch<{ transactions: GoldTxn[] }>(
    activeTeamId ? `/gold?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );

  if (!activeTeamId) return <ErrorNote>Select a team first.</ErrorNote>;
  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!s) return null;

  const o = s.overall;
  const shareOff = Math.abs(s.totalActiveShare - 100) > 0.01;
  const soldPct = o.goldBoughtGrams > 0 ? (o.goldSoldGrams / o.goldBoughtGrams) * 100 : 0;
  const stockPct = o.goldBoughtGrams > 0 ? (o.stockLeftGrams / o.goldBoughtGrams) * 100 : 0;
  const marginPerG = o.avgSellRate - o.avgBuyRate;
  // stock valued at the achieved avg sell rate vs its weighted-avg cost
  const unrealised =
    o.avgSellRate > 0 ? o.stockLeftGrams * (o.avgSellRate - o.avgBuyRate) : 0;
  const netOfSales = o.goldSoldValue > 0 ? (o.netProfit / o.goldSoldValue) * 100 : 0;
  const expenseLoad = o.grossProfit > 0 ? (o.totalExpenses / o.grossProfit) * 100 : 0;

  const txns = g?.transactions ?? [];
  const recent = [...txns].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 6);
  const maxTicket = Math.max(1, ...txns.map((t) => t.totalAmount));

  const cats = [...(s.expensesByCategory ?? [])].sort((a, b) => b.amount - a.amount);
  const maxCat = Math.max(1, ...cats.map((c) => c.amount));

  const split = s.investorSplit;
  const distributed = split.reduce((a, r) => a + r.netShare, 0);

  const dateSpan =
    s.daily.length > 0
      ? `${shortDate(s.daily[0].date).replace(/ \d{4}$/, "")} – ${shortDate(s.daily[s.daily.length - 1].date)}`
      : "";

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          <>
            Book overview <Dot /> <b className="font-mono text-[12px] font-semibold text-graphite-700">{s.counts.transactions}</b> trades
            <Dot /> <b className="font-mono text-[12px] font-semibold text-graphite-700">{s.counts.expenses}</b> expenses
            <Dot /> <b className="font-mono text-[12px] font-semibold text-graphite-700">{s.counts.investors}</b> investors
            {dateSpan && (
              <>
                <Dot /> {dateSpan}
              </>
            )}
          </>
        }
        action={
          <>
            <span className="glass-thin hidden items-center gap-2 rounded-full border border-graphite-200 bg-ink-800 px-3.5 py-2 text-[12.5px] text-graphite-500 xl:flex">
              <Search size={14} /> Search trades, investors
            </span>
            <span className="glass-thin hidden items-center gap-2 rounded-full border border-graphite-200 bg-ink-800 px-3.5 py-[7px] sm:flex">
              <span className="h-2 w-2 rounded-full bg-gold-500 shadow-[0_0_0_4px_var(--color-glow)]" />
              <b className="font-mono text-[13px] font-semibold text-gold-500">{money(o.avgSellRate)}</b>
              <span className="text-[11px] text-graphite-500">/g avg sell</span>
            </span>
            <Link
              to="/admin/reports"
              className="glass-thin rounded-full border border-graphite-200 bg-ink-800 px-4 py-[9px] text-[12px] font-semibold text-graphite-700 transition-[transform,color,border-color] duration-150 ease-out hover:border-gold-lo hover:text-graphite-900 active:scale-[0.97]"
            >
              Profit &amp; Loss
            </Link>
            <Link
              to="/admin/gold"
              className="rounded-full bg-[linear-gradient(145deg,var(--color-gold-hi),var(--color-gold-500)_60%,var(--color-gold-lo))] px-4 py-[10px] text-[12.5px] font-semibold text-chrome-950 shadow-[0_8px_20px_-8px_var(--color-glow)] transition-transform duration-150 ease-out hover:brightness-105 active:scale-[0.97]"
            >
              Record trade
            </Link>
          </>
        }
      />

      {shareOff && (
        <div className="glass-thin mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning/[0.11] px-4 py-2.5 text-[13px] text-graphite-700 sm:rounded-full sm:px-5">
          <AlertTriangle size={16} className="flex-none text-warning" />
          <span>
            Active investor shares total{" "}
            <b className="font-mono font-semibold text-warning">{pct(s.totalActiveShare)}</b> — payouts stay locked
            until the book reaches 100%.
          </span>
          <Link to="/admin/investors" className="ml-auto text-[12px] font-semibold text-graphite-900 underline underline-offset-[3px]">
            Fix in Investors →
          </Link>
        </div>
      )}

      <div className="bento">
        {/* ── gauge ── */}
        <Tile area="gauge" className="items-center text-center">
          <div className="mb-3.5 flex w-full items-baseline justify-between">
            <h2 className="m-0 font-serif text-[15px] font-semibold text-graphite-900">Position</h2>
            <span className="text-[11px] text-graphite-500">Sold through</span>
          </div>
          <Gauge pctValue={soldPct} />
          <div className="mt-auto flex w-full flex-col gap-3.5 pt-4">
            <div className="flex justify-between gap-2.5 text-left">
              <div className="flex-1">
                <Kicker>Bought</Kicker>
                <div className="mt-0.5 font-serif text-[19px] font-semibold -tracking-[0.02em] text-gold-500">{grams(o.goldBoughtGrams)}</div>
              </div>
              <div className="flex-1 text-right">
                <Kicker>Sold</Kicker>
                <div className="mt-0.5 font-serif text-[19px] font-semibold -tracking-[0.02em] text-graphite-900">{grams(o.goldSoldGrams)}</div>
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between">
                <Kicker>Stock left</Kicker>
                <span className="font-mono text-[11px] text-graphite-700">{grams(o.stockLeftGrams)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                <i className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-gold-lo),var(--color-gold-500),var(--color-gold-hi))]" style={{ width: `${stockPct}%` }} />
              </div>
              <div className="mt-[7px] flex justify-between text-[11px]">
                <span className="text-graphite-500">Book cost {num(o.avgBuyRate)}/g</span>
                <span className="font-mono text-graphite-700">{money(o.stockLeftValue)}</span>
              </div>
            </div>
            <div className="flex justify-between gap-2.5 border-t border-ink-700 pt-3 text-left">
              <div className="flex-1">
                <Kicker>Purchases</Kicker>
                <div className="mt-0.5 font-serif text-[16px] font-semibold text-graphite-700">{num(o.goldBoughtValue)}</div>
              </div>
              <div className="flex-1 text-right">
                <Kicker>Sales</Kicker>
                <div className="mt-0.5 font-serif text-[16px] font-semibold text-graphite-700">{num(o.goldSoldValue)}</div>
              </div>
            </div>
          </div>
        </Tile>

        {/* ── kpis ── */}
        <Tile area="kpi">
          <TileHead title="Profit" right="Realised, this book" />
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Kicker>Net · after expenses</Kicker>
              <div className="my-2 font-serif text-[26px] sm:text-[33px] font-semibold leading-[1.05] -tracking-[0.03em] tabular-nums text-graphite-900">
                <span className="mr-1.5 text-[14px] font-normal text-graphite-500">AED</span>
                {num(o.netProfit)}
              </div>
              <Chip tone={o.netProfit >= 0 ? "pos" : "neg"}>
                {o.netProfit >= 0 ? "▲" : "▼"} {num(Math.abs(netOfSales))}% of sales
              </Chip>
            </div>
            <div className="sm:border-l sm:border-ink-700 sm:pl-4">
              <Kicker>Gross · before expenses</Kicker>
              <div className="my-2 font-serif text-[26px] sm:text-[33px] font-semibold leading-[1.05] -tracking-[0.03em] tabular-nums text-gold-500">
                <span className="mr-1.5 text-[14px] font-normal text-graphite-500">AED</span>
                {num(o.grossProfit)}
              </div>
              <Chip tone="gold">{num(marginPerG)} /g margin</Chip>
            </div>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2 border-t border-graphite-100 pt-3.5">
            {[
              { k: "Cost of gold sold", v: num(o.cogs), c: "text-graphite-900" },
              {
                k: "Unrealised on stock",
                v: `${unrealised >= 0 ? "+" : ""}${num(unrealised)}`,
                c: unrealised >= 0 ? "text-positive" : "text-negative",
              },
              { k: "Expenses", v: num(o.totalExpenses), c: "text-negative" },
            ].map((m) => (
              <div key={m.k} className="glass-thin min-w-[110px] flex-1 rounded-[13px] border border-graphite-100 bg-ink-900 px-3 py-2.5">
                <Kicker>{m.k}</Kicker>
                <div className={`mt-1 font-mono text-[14px] font-semibold tabular-nums ${m.c}`}>{m.v}</div>
              </div>
            ))}
          </div>
        </Tile>

        {/* ── map ── */}
        <Tile area="map" className="relative overflow-hidden !p-0">
          <div className="absolute left-5 right-5 top-[18px] z-[2] flex items-start justify-between gap-3">
            <div>
              <h2 className="m-0 font-serif text-[15px] font-semibold text-graphite-900">Corridors</h2>
              <div className="mt-0.5 text-[11px] text-graphite-500">Counterparties settling into Dubai</div>
            </div>
            <span className="glass-thin rounded-full border border-graphite-200 bg-ink-700 px-3 py-1.5 text-[11px] font-semibold text-graphite-700">
              This book
            </span>
          </div>
          <div className="relative min-h-[260px] flex-1">
            <WorldMap />
          </div>
          <div className="absolute bottom-[18px] left-5 z-[2] flex max-w-[56%] flex-wrap gap-2">
            {[
              { c: "var(--color-gold-500)", t: "Dubai desk", b: "hub" },
              { c: "var(--color-gold-hi)", t: "Refiners", b: "3" },
              { c: "var(--color-gold-lo)", t: "Buyers", b: "3" },
            ].map((m) => (
              <span
                key={m.t}
                className="glass-thin flex items-center gap-[7px] rounded-full border border-graphite-200 bg-ink-700 px-[11px] py-1.5 text-[11px] text-graphite-700"
              >
                <i className="block h-[7px] w-[7px] rounded-full" style={{ background: m.c }} />
                {m.t} <b className="font-mono text-graphite-900">{m.b}</b>
              </span>
            ))}
          </div>
          <div className="glass-thin absolute bottom-[18px] right-5 z-[2] rounded-[13px] border border-graphite-200 bg-ink-700 px-3.5 py-[11px] text-right">
            <Kicker>Settled value</Kicker>
            <div className="font-serif text-[22px] font-semibold -tracking-[0.02em] text-gold-500">
              {num(o.goldBoughtValue + o.goldSoldValue)}
            </div>
          </div>
        </Tile>

        {/* ── bars ── */}
        <Tile area="bars">
          <TileHead title="Trade value" right="Per ticket · AED thousands" />
          <TicketBars tickets={recent.slice().reverse()} max={maxTicket} />
        </Tile>

        {/* ── investors ── */}
        <Tile area="inv">
          <TileHead title="Profit split" right="By investor share" />
          <div className="mb-3.5 flex items-center gap-4">
            <SplitRing
              segments={split.map((r) => r.sharePercentage)}
              centre={`${Math.round(s.totalActiveShare)}%`}
              label="Allocated"
            />
            <div>
              <h3 className="m-0 mb-1.5 text-[13.5px] font-semibold text-graphite-900">
                {shareOff
                  ? `${s.totalActiveShare > 100 ? "Over" : "Under"}-allocated by ${Math.abs(Math.round(s.totalActiveShare - 100))} points`
                  : "Shares balanced at 100%"}
              </h3>
              <p className="m-0 text-[12px] leading-[1.55] text-graphite-500">
                Shares distribute{" "}
                <b className="font-mono font-medium text-graphite-700">{money(distributed)}</b> against{" "}
                <b className="font-mono font-medium text-graphite-700">{money(o.netProfit)}</b> of net profit.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {split.map((r, i) => {
              const grads = [
                "linear-gradient(145deg,var(--color-gold-hi),var(--color-gold-500))",
                "linear-gradient(145deg,var(--color-gold-500),var(--color-gold-lo))",
                "linear-gradient(145deg,var(--color-gold-lo),#6E4B18)",
              ];
              return (
                <div key={r.investorId}>
                  <div className="flex items-center gap-2.5 rounded-full bg-ink-900 py-[7px] pl-[7px] pr-3.5">
                    <div
                      className="grid h-8 w-8 flex-none place-items-center rounded-full font-serif text-[12px] font-semibold text-chrome-950"
                      style={{ background: grads[i % grads.length] }}
                    >
                      {r.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px] font-semibold text-graphite-900">{r.name}</b>
                      <small className="font-mono text-[10.5px] text-graphite-500">{num(r.sharePercentage, 0)}% share</small>
                    </div>
                    <div className={`whitespace-nowrap font-mono text-[12.5px] font-semibold tabular-nums ${r.netShare >= 0 ? "text-graphite-900" : "text-negative"}`}>
                      {num(r.netShare)}
                    </div>
                  </div>
                  {r.partnerSplit.map((p, j) => (
                    <div
                      key={j}
                      className="flex items-baseline justify-between gap-2 pl-11 pr-3.5 pt-1 font-mono text-[10.5px] text-graphite-500"
                    >
                      <span className="truncate">
                        ↳ {p.name}
                        {p.role ? ` · ${p.role}` : ""} {p.percentage}%
                      </span>
                      <span className={`tabular-nums ${p.share < 0 ? "text-negative" : "text-graphite-700"}`}>
                        {num(p.share)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
            {split.length === 0 && <p className="py-6 text-center text-[12px] text-graphite-500">No active investors.</p>}
          </div>
        </Tile>

        {/* ── trades ── */}
        <Tile area="trades">
          <div className="mb-3.5 flex items-baseline justify-between">
            <h2 className="m-0 font-serif text-[15px] font-semibold text-graphite-900">Recent trades</h2>
            <Link
              to="/admin/gold"
              className="rounded-full border border-ink-600 bg-ink-800 px-3 py-1.5 text-[11px] font-semibold text-graphite-700 hover:text-graphite-900"
            >
              View all {s.counts.transactions}
            </Link>
          </div>
          <div className="flex flex-col gap-[7px] sm:overflow-x-auto">
            <div className="hidden min-w-[520px] grid-cols-[52px_58px_minmax(120px,1fr)_70px_74px_92px] gap-3 px-[18px] pb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-graphite-500 sm:grid">
              <span>Date</span>
              <span>Side</span>
              <span>Counterparty</span>
              <span className="text-right">Weight</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Value</span>
            </div>
            {recent.map((t) => {
              const sideBadge = (
                <span
                  className={`inline-flex w-14 flex-none justify-center rounded-full py-[3px] font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${
                    t.type === "BUY" ? "bg-warning/12 text-gold-500" : "bg-positive/12 text-positive"
                  }`}
                >
                  {t.type === "BUY" ? "Buy" : "Sell"}
                </span>
              );
              const day = new Date(t.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
              return (
                <div key={t.id}>
                  {/* mobile: stacked card */}
                  <div className="flex items-center gap-3 rounded-2xl bg-ink-900 px-3.5 py-2.5 sm:hidden">
                    {sideBadge}
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px] font-medium text-graphite-800">
                        {t.counterparty || "—"}{" "}
                        <em className="font-mono text-[10.5px] not-italic text-graphite-400">{t.quality}</em>
                      </b>
                      <small className="font-mono text-[10.5px] text-graphite-500">
                        {day} · {num(t.quantityGrams, 0)} g @ {num(t.ratePerGram)}
                      </small>
                    </div>
                    <span className="whitespace-nowrap font-mono text-[12.5px] font-semibold tabular-nums text-graphite-900">
                      {num(t.totalAmount)}
                    </span>
                  </div>
                  {/* desktop: grid row */}
                  <div className="hidden min-w-[520px] grid-cols-[52px_58px_minmax(120px,1fr)_70px_74px_92px] items-center gap-3 rounded-full bg-ink-900 px-[18px] py-[9px] sm:grid">
                    <span className="whitespace-nowrap font-mono text-[11.5px] text-graphite-500">{day}</span>
                    {sideBadge}
                    <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-graphite-800">
                      {t.counterparty || "—"} <em className="font-mono text-[10.5px] not-italic text-graphite-400">{t.quality}</em>
                    </span>
                    <span className="text-right font-mono text-[12.5px] tabular-nums text-graphite-700">{num(t.quantityGrams, 0)} g</span>
                    <span className="text-right font-mono text-[12.5px] tabular-nums text-graphite-700">{num(t.ratePerGram)}</span>
                    <span className="text-right font-mono text-[12.5px] font-medium tabular-nums text-graphite-900">{num(t.totalAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap justify-between gap-2.5 border-t border-ink-700 pt-3 font-mono text-[11.5px] text-graphite-500">
            <span>
              Bought <b className="font-semibold text-graphite-700">{grams(o.goldBoughtGrams)}</b> · Sold{" "}
              <b className="font-semibold text-graphite-700">{grams(o.goldSoldGrams)}</b> · Stock{" "}
              <b className="font-semibold text-graphite-700">{grams(o.stockLeftGrams)}</b>
            </span>
            <span>
              Net outflow <b className="font-semibold text-graphite-700">{money(o.goldBoughtValue - o.goldSoldValue)}</b>
            </span>
          </div>
        </Tile>

        {/* ── trend ── */}
        <Tile area="trend">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="m-0 font-serif text-[15px] font-semibold text-graphite-900">Profit trend</h2>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-graphite-500">
              <span className="flex items-center gap-1.5">
                <svg width="16" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="16" y2="2" stroke="var(--color-graphite-600)" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
                </svg>
                Gross <b className="font-mono font-semibold text-graphite-700">{num(o.grossProfit)}</b>
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="4" aria-hidden>
                  <line x1="0" y1="2" x2="16" y2="2" stroke={goldStroke} strokeWidth="3" />
                </svg>
                Net <b className="font-mono font-semibold text-gold-500">{num(o.netProfit)}</b>
              </span>
            </div>
          </div>
          <TrendChart daily={s.daily} />
          <div className="mt-1 text-[9.5px] text-graphite-400">Dips are expense postings · steps up are sales</div>
        </Tile>

        {/* ── expenses ── */}
        <Tile area="exp">
          <TileHead title="Expenses" right={`${s.counts.expenses} postings`} />
          <div className="mb-4 flex items-baseline gap-2.5">
            <Kicker>Total</Kicker>
            <span className="font-serif text-[23px] font-semibold -tracking-[0.03em] text-negative sm:text-[29px]">{money(o.totalExpenses)}</span>
          </div>
          <div className="flex flex-1 flex-col gap-3.5">
            {cats.map((c) => (
              <div key={c.name}>
                <div className="mb-1.5 flex justify-between gap-2.5 text-[12.5px]">
                  <span className="text-graphite-800">{c.name}</span>
                  <b className="font-mono font-semibold tabular-nums">{num(c.amount)}</b>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                  <i
                    className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-gold-lo),var(--color-gold-500))]"
                    style={{ width: `${(c.amount / maxCat) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {cats.length === 0 && <p className="py-4 text-[12px] text-graphite-500">No expenses recorded yet.</p>}
          </div>
          <div className="mt-3.5 rounded-[13px] bg-ink-900 px-3.5 py-3 text-[11.5px] leading-[1.5] text-graphite-500">
            Expenses absorb <b className="font-mono font-semibold text-graphite-700">{num(expenseLoad)}%</b> of gross profit.
            {cats[0] && (
              <>
                {" "}
                {cats[0].name} is the largest header at{" "}
                <b className="font-mono font-semibold text-graphite-700">{num((cats[0].amount / o.totalExpenses) * 100)}%</b> of the total.
              </>
            )}
          </div>
        </Tile>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-graphite-400">
        <ArrowUpRight size={12} /> Generated {shortDate(s.generatedAt)} · cost basis: weighted-average purchase rate ({num(o.avgBuyRate)}/g)
      </p>
    </>
  );
}
