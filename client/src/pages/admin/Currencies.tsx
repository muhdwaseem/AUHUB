import { FormEvent, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Currency } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, Spinner } from "../../components/ui";
import { relTime } from "../../currency";

export default function Currencies() {
  const { data, loading, error, reload } = useFetch<Currency[]>("/currencies");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [form, setForm] = useState({ code: "", symbol: "", decimals: "2" });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  // "Today's rates" panel state: code -> rate string
  const [rates, setRates] = useState<Record<string, string>>({});
  const [rateErr, setRateErr] = useState("");
  const [rateBusy, setRateBusy] = useState(false);
  useEffect(() => {
    if (data) {
      setRates(Object.fromEntries(data.filter((c) => !c.isBase).map((c) => [c.code, String(c.rate)])));
    }
  }, [data]);

  const base = data?.find((c) => c.isBase);
  const others = (data ?? []).filter((c) => !c.isBase);

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
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function saveRates(e: FormEvent) {
    e.preventDefault();
    setRateErr("");
    const rows = others.map((c) => ({ code: c.code, rate: Number(rates[c.code]) }));
    const bad = rows.find((r) => !(r.rate > 0));
    if (bad) {
      setRateErr(`Enter a rate greater than 0 for ${bad.code}.`);
      return;
    }
    setRateBusy(true);
    try {
      await api.post("/currencies/rates", { rates: rows });
      reload();
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

      {/* Today's rates — the admin updates these daily */}
      {others.length > 0 && (
        <Card title="Today's rates" className="mb-6">
          <form onSubmit={saveRates} className="p-4">
            <p className="mb-3 text-[12px] text-graphite-400">
              The rate a new trade or expense in that currency is priced at. Update it whenever
              the market moves — the value you save here pre-fills the currency dropdown on every
              form (still editable per record).
            </p>
            <div className="space-y-2.5">
              {others.map((c) => {
                const r = Number(rates[c.code]);
                const stale =
                  !c.rateUpdatedAt ||
                  Date.now() - new Date(c.rateUpdatedAt).getTime() > 24 * 3600 * 1000;
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
                          step="0.0001"
                          min="0"
                          inputMode="decimal"
                          className="text-right"
                          value={rates[c.code] ?? ""}
                          onChange={(e) => setRates({ ...rates, [c.code]: e.target.value })}
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-graphite-400">
                      {r > 0 && `≈ ${(1 / r).toLocaleString("en-US", { maximumFractionDigits: 4 })} ${c.code} per ${baseCode} · `}
                      <span className={stale ? "text-warning" : ""}>
                        updated {relTime(c.rateUpdatedAt)}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>
            {rateErr && <div className="mt-3"><ErrorNote>{rateErr}</ErrorNote></div>}
            <div className="mt-4 flex">
              <Button
                type="submit"
                disabled={rateBusy}
                className="w-full sm:ml-auto sm:w-auto"
              >
                {rateBusy ? "Saving…" : "Save today's rates"}
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
                    1 {c.code} = {c.rate.toLocaleString("en-US", { maximumFractionDigits: 4 })}{" "}
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
          <Field label="Decimal places" required hint="2 for most; 0 for currencies like IDR / VND.">
            <Input
              type="number"
              min={0}
              max={4}
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
