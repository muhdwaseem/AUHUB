import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Currency, CurrencyRateOn } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, Spinner } from "../../components/ui";
import { relTime, useCurrency } from "../../currency";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function Currencies() {
  const { data, loading, error, reload } = useFetch<Currency[]>("/currencies");
  // This page's own useFetch keeps its own copy of the list for the
  // management table below; every other page (trade/expense/investor forms)
  // reads currencies from this shared context instead, which fetches once
  // when the app loads and otherwise never refreshes on its own — so any
  // add/edit/delete/rate-save here also has to nudge the context's reload,
  // or the rest of the app keeps showing the old list until a full refresh.
  const { rateOn, reload: reloadCtx } = useCurrency();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [form, setForm] = useState({ code: "", symbol: "", decimals: "2" });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Rates panel: which date is being viewed/edited, its rates (code -> string),
  // and where each one actually came from (exact hit for that date, or a
  // fallback to the nearest earlier saved rate).
  const [rateDate, setRateDate] = useState(todayStr());
  const [rates, setRates] = useState<Record<string, string>>({});
  const [resolvedInfo, setResolvedInfo] = useState<Record<string, CurrencyRateOn>>({});
  const [rateErr, setRateErr] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    setRateLoading(true);
    rateOn(rateDate).then((rows) => {
      if (cancelled) return;
      const info: Record<string, CurrencyRateOn> = {};
      const vals: Record<string, string> = {};
      for (const r of rows) {
        info[r.code] = r;
        // Only pre-fill when a rate was actually saved for THIS date — never
        // silently carry an older day's rate into the input as if it were set.
        vals[r.code] = r.exact ? String(r.rate) : "";
      }
      setResolvedInfo(info);
      setRates(vals);
      setRateLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, rateDate]);

  const base = data?.find((c) => c.isBase);
  const others = (data ?? []).filter((c) => !c.isBase);
  const isToday = rateDate === todayStr();

  function openAdd() {
    setEditing(null);
    setForm({ code: "", symbol: "", decimals: "2" });
    setFormErr("");
    setOpen(true);
  }
  function openEdit(c: Currency) {
    setEditing(c);
    setForm({ code: c.code, symbol: c.symbol, decimals: String(c.decimals) });
    setFormErr("");
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr("");
    try {
      const payload = {
        code: form.code.trim().toUpperCase(),
        symbol: form.symbol.trim(),
        decimals: Number(form.decimals || 0),
      };
      if (editing) {
        await api.put(`/currencies/${editing.id}`, {
          symbol: payload.symbol,
          decimals: payload.decimals,
        });
      } else {
        await api.post("/currencies", payload);
      }
      setOpen(false);
      reload();
      reloadCtx();
    } catch (err) {
      setFormErr(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Currency) {
    if (!confirm(`Delete the ${c.code} currency?`)) return;
    try {
      await api.delete(`/currencies/${c.id}`);
      reload();
      reloadCtx();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function saveRates(e: FormEvent) {
    e.preventDefault();
    setRateErr("");
    // Only the currencies you actually typed a value for — a blank field
    // means "not set for this date yet", not "leave it as whatever it was".
    const filled = others.filter((c) => (rates[c.code] ?? "").trim() !== "");
    if (filled.length === 0) {
      setRateErr("Enter at least one rate to save.");
      return;
    }
    const rows = filled.map((c) => ({ code: c.code, rate: Number(rates[c.code]) }));
    const bad = rows.find((r) => !(r.rate > 0));
    if (bad) {
      setRateErr(`Enter a rate greater than 0 for ${bad.code}.`);
      return;
    }
    setRateBusy(true);
    try {
      await api.post("/currencies/rates", { date: rateDate, rates: rows });
      reload();
      reloadCtx();
      // We know exactly what was just saved — update in place rather than
      // re-fetching (the rateOn() cache would still hand back the stale value).
      setResolvedInfo((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.code] = { code: r.code, rate: r.rate, resolvedDate: rateDate, exact: true };
        return next;
      });
    } catch (err) {
      setRateErr(apiError(err));
    } finally {
      setRateBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const baseCode = base?.code ?? "AED";

  return (
    <>
      <PageHeader
        title="Currencies"
        subtitle={`Record a trade, expense or capital amount in any of these. Everything rolls up to ${baseCode} on reports using today's rate (or a rate you override on the record itself).`}
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> Add currency
          </Button>
        }
      />

      {/* Rates for a date — defaults to today, but any past day can be set or
          corrected so a trade dated back then pulls the rate that actually
          applied, not whatever the rate happens to be today. */}
      {others.length > 0 && (
        <Card title={isToday ? "Today's rates" : `Rates for ${rateDate}`} className="mb-6">
          <form onSubmit={saveRates} className="p-4">
            <p className="mb-3 text-[12px] text-graphite-400">
              The rate a trade or expense dated on this day is priced at — every form pulls its
              fx-rate from whatever's saved for its own date (still editable per record). Pick an
              earlier date here to back-fill or correct a past day's rate.
            </p>
            <div className="mb-3 max-w-[200px]">
              <Field label="Date">
                <Input
                  type="date"
                  max={todayStr()}
                  value={rateDate}
                  onChange={(e) => setRateDate(e.target.value)}
                />
              </Field>
            </div>
            <div className="space-y-2.5">
              {others.map((c) => {
                const r = Number(rates[c.code]);
                const info = resolvedInfo[c.code];
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-graphite-100 bg-ink-900/30 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor={`rate-${c.code}`}
                        className="text-[13px] font-semibold text-graphite-700"
                      >
                        1 {c.code} = <span className="text-graphite-400">{baseCode}</span>
                      </label>
                      <div className="w-32 flex-none">
                        <Input
                          id={`rate-${c.code}`}
                          type="number"
                          step="any"
                          min="0"
                          inputMode="decimal"
                          disabled={rateLoading}
                          className="text-right"
                          value={rates[c.code] ?? ""}
                          onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-graphite-400">
                      {r > 0 && `≈ ${(1 / r).toLocaleString("en-US", { maximumFractionDigits: 9 })} ${c.code} per ${baseCode} · `}
                      {rateLoading ? (
                        "loading…"
                      ) : info?.exact ? (
                        <span className={isToday ? "" : "text-positive"}>
                          set for {rateDate}
                        </span>
                      ) : info?.resolvedDate ? (
                        <span className="text-warning">
                          not set for {rateDate} yet — enter it below (for reference, {info.resolvedDate}
                          's rate was {info.rate})
                        </span>
                      ) : (
                        <span className="text-warning">never set — enter a rate below</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
            {rateErr && <div className="mt-3"><ErrorNote>{rateErr}</ErrorNote></div>}
            <div className="mt-4 flex">
              <Button
                type="submit"
                disabled={rateBusy || rateLoading}
                className="w-full sm:ml-auto sm:w-auto"
              >
                {rateBusy ? "Saving…" : `Save rates for ${isToday ? "today" : rateDate}`}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <div className="divide-y divide-graphite-50">
          {data?.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 px-3.5 py-3.5 sm:px-5"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-mono text-sm font-semibold text-graphite-800">{c.code}</span>
                <span className="text-sm text-graphite-500">{c.symbol}</span>
                <span className="text-xs text-graphite-400">{c.decimals} decimals</span>
                {c.isBase ? (
                  <Badge tone="gold">base</Badge>
                ) : (
                  <span className="text-xs text-graphite-400">
                    1 {c.code} = {c.rate.toLocaleString("en-US", { maximumFractionDigits: 9 })}{" "}
                    {baseCode} · {relTime(c.rateUpdatedAt)}
                  </span>
                )}
              </div>
              <div className="flex flex-none gap-1">
                <button
                  onClick={() => openEdit(c)}
                  aria-label="Edit currency"
                  className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
                >
                  <Pencil size={15} />
                </button>
                {!c.isBase && (
                  <button
                    onClick={() => remove(c)}
                    aria-label="Delete currency"
                    className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="px-5 py-14 text-center text-sm text-graphite-400">No currencies yet.</div>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.code}` : "Add currency"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Code" required hint="2–6 letters, e.g. USD. Can't be changed later.">
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              disabled={!!editing}
              autoFocus={!editing}
              placeholder="USD"
              maxLength={6}
            />
          </Field>
          <Field label="Symbol" required hint="Shown before the amount, e.g. $ or ฿ or Rp.">
            <Input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              autoFocus={!!editing}
              placeholder="$"
              maxLength={6}
            />
          </Field>
          <Field
            label="Decimal places"
            required
            hint="2 for most; 0 for currencies like IDR / VND; up to 9 for high-precision ones like a stablecoin."
          >
            <Input
              type="number"
              min={0}
              max={9}
              value={form.decimals}
              onChange={(e) => setForm({ ...form, decimals: e.target.value })}
            />
          </Field>
          {!editing && (
            <p className="rounded-lg bg-graphite-50 px-3 py-2 text-xs text-graphite-500">
              After adding it, set today's rate in the “Today's rates” panel.
            </p>
          )}
          {formErr && <ErrorNote>{formErr}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save" : "Add currency"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
