import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { GoldTxn } from "../../types";
import { PageHeader } from "../../components/AppShell";
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Input,
  Modal,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { grams, shortDate, dateInput } from "../../format";
import { useCurrency, rateHint } from "../../currency";
import type { CurrencyRateOn } from "../../types";
import { useTeam } from "../../team";
import { ConversionHops, type HopRow } from "../../components/ConversionHops";

interface ListResp {
  transactions: GoldTxn[];
}

const blank = {
  type: "BUY" as "BUY" | "SELL",
  date: dateInput(),
  quality: "24K",
  quantityGrams: "",
  ratePerGram: "",
  currencyCode: "AED",
  fxRate: "1",
  counterparty: "",
  notes: "",
  hops: [] as HopRow[],
};

export default function Gold() {
  const { currencies, base, fmt, rateOn } = useCurrency();
  const { activeTeamId, activeTeam } = useTeam();
  const [typeFilter, setTypeFilter] = useState("");
  const { data, loading, error, reload } = useFetch<ListResp>(
    activeTeamId
      ? `/gold?teamId=${activeTeamId}${typeFilter ? `&type=${typeFilter}` : ""}`
      : null,
    [typeFilter, activeTeamId]
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoldTxn | null>(null);
  const [form, setForm] = useState(blank);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  // The rate as resolved for the form's own date (falls back to the nearest
  // earlier saved rate) — shown in the hint; only auto-fills fxRate when the
  // user actively changes the date or currency, never on opening an existing
  // trade (that must keep showing its own stored rate until touched).
  const [dateRateInfo, setDateRateInfo] = useState<CurrencyRateOn | null>(null);

  async function refreshRateInfo(date: string, code: string, autofill: boolean) {
    if (code === base.code) {
      setDateRateInfo(null);
      return;
    }
    const rows = await rateOn(date);
    const info = rows.find((r) => r.code === code) ?? null;
    setDateRateInfo(info);
    if (autofill) {
      // Only an exact rate for THIS date ever lands in the field — a
      // fallback from another day is shown as reference text, never
      // silently filled in as if it were the real rate for this one.
      setForm((f) =>
        f.date === date && f.currencyCode === code ? { ...f, fxRate: info?.exact ? String(info.rate) : "" } : f
      );
    }
  }

  function openAdd() {
    setEditing(null);
    setForm({ ...blank, currencyCode: base.code });
    setFormErr("");
    setDateRateInfo(null);
    setOpen(true);
  }
  function openEdit(t: GoldTxn) {
    setEditing(t);
    const date = t.date.slice(0, 10);
    setForm({
      type: t.type,
      date,
      quality: t.quality,
      quantityGrams: String(t.quantityGrams),
      ratePerGram: String(t.ratePerGram),
      currencyCode: t.currencyCode ?? "AED",
      fxRate: String(t.fxRate ?? 1),
      counterparty: t.counterparty ?? "",
      notes: t.notes ?? "",
      hops: (t.hops ?? []).map((h) => ({
        fromCurrency: h.fromCurrency,
        fromAmount: String(h.fromAmount),
        toCurrency: h.toCurrency,
        toAmount: String(h.toAmount),
        date: h.date.slice(0, 10),
        notes: h.notes ?? "",
      })),
    });
    setFormErr("");
    refreshRateInfo(date, t.currencyCode ?? "AED", false);
    setOpen(true);
  }

  const preview =
    Number(form.quantityGrams || 0) * Number(form.ratePerGram || 0) || 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    // A blank fx-rate must never silently become "1" — that would record a
    // foreign-currency trade as if it cost 1:1 in the base currency. Block
    // the submit instead and make the admin actually enter it.
    if (form.currencyCode !== base.code && !(Number(form.fxRate) > 0)) {
      setFormErr(`Enter the exchange rate (1 ${form.currencyCode} = ? ${base.code}) before saving.`);
      return;
    }
    setBusy(true);
    setFormErr("");
    try {
      const payload = {
        type: form.type,
        teamId: activeTeamId,
        date: form.date,
        quality: form.quality,
        quantityGrams: Number(form.quantityGrams),
        ratePerGram: Number(form.ratePerGram),
        currencyCode: form.currencyCode,
        fxRate: form.currencyCode === base.code ? 1 : Number(form.fxRate),
        counterparty: form.counterparty,
        notes: form.notes,
        hops: form.hops.map((h, i) => ({
          order: i + 1,
          fromCurrency: h.fromCurrency,
          fromAmount: Number(h.fromAmount),
          toCurrency: h.toCurrency,
          toAmount: Number(h.toAmount),
          date: h.date,
          notes: h.notes,
        })),
      };
      if (editing) await api.put(`/gold/${editing.id}`, payload);
      else await api.post("/gold", payload);
      setOpen(false);
      reload();
    } catch (err) {
      setFormErr(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: GoldTxn) {
    if (!confirm(`Delete this ${t.type.toLowerCase()} of ${grams(t.quantityGrams)}?`))
      return;
    try {
      await api.delete(`/gold/${t.id}`);
      reload();
    } catch (err) {
      alert(apiError(err));
    }
  }

  if (!activeTeamId)
    return (
      <>
        <PageHeader title="Gold Trades" subtitle="Trades belong to a team." />
        <Card>
          <p className="px-5 py-14 text-center text-sm text-graphite-400">
            No team selected. Create one on the <b className="text-graphite-600">Teams</b> page
            first.
          </p>
        </Card>
      </>
    );
  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const rowActions = (t: GoldTxn) => (
    <div className="flex justify-end gap-1">
      <button
        onClick={() => openEdit(t)}
        aria-label="Edit trade"
        className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={() => remove(t)}
        aria-label="Delete trade"
        className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <>
      <PageHeader
        title="Gold Trades"
        subtitle={`${activeTeam?.name ?? "This team"} · every purchase and sale, with quality/purity and rate per gram. New trades are filed under this team.`}
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> Add trade
          </Button>
        }
      />

      <div className="mb-4 flex gap-2">
        {["", "BUY", "SELL"].map((t) => (
          <button
            key={t || "all"}
            onClick={() => setTypeFilter(t)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              typeFilter === t
                ? "bg-chrome-800 text-white"
                : "bg-ink-800 text-graphite-600 border border-ink-600 hover:bg-ink-700"
            }`}
          >
            {t === "" ? "All" : t === "BUY" ? "Purchases" : "Sales"}
          </button>
        ))}
      </div>

      <Card variant="flat">
        {data?.transactions.length === 0 && (
          <p className="px-4 py-14 text-center text-sm text-graphite-400">No trades recorded.</p>
        )}

        {/* mobile: one card per trade */}
        <div className="divide-y divide-graphite-50 sm:hidden">
          {data?.transactions.map((t) => (
            <div key={t.id} className="px-3.5 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone={t.type === "BUY" ? "amber" : "green"}>
                    {t.type === "BUY" ? "Purchase" : "Sale"}
                  </Badge>
                  <span className="font-medium text-graphite-700">{t.quality}</span>
                </div>
                <span className="text-xs text-graphite-400">{shortDate(t.date)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-graphite-400">Weight</div>
                  <b className="tnum font-medium">{grams(t.quantityGrams)}</b>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-graphite-400">Rate/g</div>
                  <b className="tnum font-medium">{fmt(t.ratePerGram, t.currencyCode)}</b>
                  {t.currencyCode !== base.code && (
                    <span className="tnum block text-[11px] text-graphite-400">
                      ≈ {fmt(t.ratePerGram * t.fxRate)}
                    </span>
                  )}
                </div>
                <div className="col-span-2 flex items-baseline justify-between border-t border-graphite-100 pt-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-graphite-400">Total</span>
                  <span className="text-right">
                    <b className="tnum font-medium text-graphite-900">
                      {fmt(t.totalAmount, t.currencyCode)}
                    </b>
                    {t.currencyCode !== base.code && (
                      <span className="tnum block text-[11px] text-graphite-400">
                        ≈ {fmt(t.totalAmount * t.fxRate)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              {(t.counterparty || (t.hops ?? []).length > 0) && (
                <div className="mt-1.5 flex items-center gap-1.5 truncate text-[11.5px] text-graphite-400">
                  {t.counterparty && <span className="truncate">{t.counterparty}</span>}
                  {(t.hops ?? []).length > 0 && (
                    <span className="flex-none rounded-full bg-graphite-100 px-1.5 py-0.5 text-[10px] font-medium text-graphite-500">
                      {t.hops.length}-step conversion
                    </span>
                  )}
                </div>
              )}
              <div className="mt-1.5 border-t border-graphite-100 pt-1.5">{rowActions(t)}</div>
            </div>
          ))}
        </div>

        {/* desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-5 py-2.5 font-medium">Type</th>
                <th className="px-5 py-2.5 font-medium">Quality</th>
                <th className="px-5 py-2.5 text-right font-medium">Weight</th>
                <th className="px-5 py-2.5 text-right font-medium">Rate/g</th>
                <th className="px-5 py-2.5 text-right font-medium">Total</th>
                <th className="px-5 py-2.5 font-medium">Counterparty</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-50">
              {data?.transactions.map((t) => (
                <tr key={t.id} className="hover:bg-graphite-50/60">
                  <td className="px-5 py-3 align-top text-graphite-600">{shortDate(t.date)}</td>
                  <td className="px-5 py-3 align-top">
                    <Badge tone={t.type === "BUY" ? "amber" : "green"}>
                      {t.type === "BUY" ? "Purchase" : "Sale"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 align-top font-medium text-graphite-700">{t.quality}</td>
                  <td className="px-5 py-3 align-top text-right tnum">{grams(t.quantityGrams)}</td>
                  <td className="px-5 py-3 align-top text-right">
                    <div className="tnum">{fmt(t.ratePerGram, t.currencyCode)}</div>
                    {t.currencyCode !== base.code && (
                      <div className="text-[11px] tnum text-graphite-400">
                        ≈ {fmt(t.ratePerGram * t.fxRate)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top text-right">
                    <div className="tnum font-medium">{fmt(t.totalAmount, t.currencyCode)}</div>
                    {t.currencyCode !== base.code && (
                      <div className="text-[11px] tnum text-graphite-400">
                        ≈ {fmt(t.totalAmount * t.fxRate)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top text-xs text-graphite-500">
                    {t.counterparty || "—"}
                    {(t.hops ?? []).length > 0 && (
                      <span className="ml-1.5 rounded-full bg-graphite-100 px-1.5 py-0.5 text-[10px] font-medium text-graphite-500">
                        {t.hops.length}-step
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 align-top">{rowActions(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit trade" : "Add gold trade"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type" required>
              <select
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-graphite-900"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as "BUY" | "SELL" })
                }
              >
                <option value="BUY">Purchase (BUY)</option>
                <option value="SELL">Sale (SELL)</option>
              </select>
            </Field>
            <Field label="Date" required>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => {
                  const date = e.target.value;
                  setForm({ ...form, date });
                  refreshRateInfo(date, form.currencyCode, true);
                }}
              />
            </Field>
          </div>
          <Field label="Quality / purity" required hint="e.g. 24K, 22K, 999, 916">
            <Input
              value={form.quality}
              onChange={(e) => setForm({ ...form, quality: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Weight (grams)" required>
              <Input
                type="number"
                step="0.001"
                min="0"
                value={form.quantityGrams}
                onChange={(e) => setForm({ ...form, quantityGrams: e.target.value })}
              />
            </Field>
            <Field label="Rate per gram" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.ratePerGram}
                onChange={(e) => setForm({ ...form, ratePerGram: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Currency" required>
              <Select
                value={form.currencyCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setForm({
                    ...form,
                    currencyCode: code,
                    // Blank until we know there's an exact rate for this date —
                    // never guess from the currency's last-known rate.
                    fxRate: code === base.code ? "1" : "",
                  });
                  refreshRateInfo(form.date, code, true);
                }}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.symbol !== c.code ? `(${c.symbol})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {form.currencyCode !== base.code && (
              <Field
                label={`1 ${form.currencyCode} = ? ${base.code}`}
                required
                hint={`${
                  dateRateInfo ? rateHint(dateRateInfo, form.date, base.code) : "Checking the rate for this date…"
                } Enter the rate this trade actually used.`}
              >
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={form.fxRate}
                  onChange={(e) => setForm({ ...form, fxRate: e.target.value })}
                />
              </Field>
            )}
          </div>
          <ConversionHops
            hops={form.hops}
            onChange={(hops) => setForm({ ...form, hops })}
            currencies={currencies}
            baseCode={base.code}
            onApplyRate={(fromCurrency, rate) =>
              setForm((f) => ({ ...f, currencyCode: fromCurrency, fxRate: String(rate) }))
            }
          />
          <div className="rounded-lg bg-gold-500/10 px-3 py-2 text-sm text-accent-text">
            Transaction total: <strong className="tnum">{fmt(preview, form.currencyCode)}</strong>
            {form.currencyCode !== base.code && Number(form.fxRate) > 0 && (
              <span className="ml-1 text-graphite-500">
                ≈ {fmt(preview * Number(form.fxRate))}
              </span>
            )}
          </div>
          <Field label="Counterparty">
            <Input
              placeholder="Supplier or buyer"
              value={form.counterparty}
              onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
            />
          </Field>
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {formErr && <ErrorNote>{formErr}</ErrorNote>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add trade"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
