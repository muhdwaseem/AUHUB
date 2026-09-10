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
import { useCurrency, relTime } from "../../currency";

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
};

export default function Gold() {
  const { currencies, base, byCode, fmt } = useCurrency();
  const [typeFilter, setTypeFilter] = useState("");
  const { data, loading, error, reload } = useFetch<ListResp>(
    `/gold${typeFilter ? `?type=${typeFilter}` : ""}`,
    [typeFilter]
  );
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GoldTxn | null>(null);
  const [form, setForm] = useState(blank);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(blank);
    setFormErr("");
    setOpen(true);
  }
  function openEdit(t: GoldTxn) {
    setEditing(t);
    setForm({
      type: t.type,
      date: t.date.slice(0, 10),
      quality: t.quality,
      quantityGrams: String(t.quantityGrams),
      ratePerGram: String(t.ratePerGram),
      currencyCode: t.currencyCode ?? "AED",
      fxRate: String(t.fxRate ?? 1),
      counterparty: t.counterparty ?? "",
      notes: t.notes ?? "",
    });
    setFormErr("");
    setOpen(true);
  }

  const preview =
    Number(form.quantityGrams || 0) * Number(form.ratePerGram || 0) || 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr("");
    try {
      const payload = {
        type: form.type,
        date: form.date,
        quality: form.quality,
        quantityGrams: Number(form.quantityGrams),
        ratePerGram: Number(form.ratePerGram),
        currencyCode: form.currencyCode,
        fxRate: form.currencyCode === base.code ? 1 : Number(form.fxRate || 1),
        counterparty: form.counterparty,
        notes: form.notes,
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
        subtitle="Every purchase and sale of gold, with quality/purity and rate per gram."
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

      <Card>
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
              <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[12.5px]">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-graphite-400">Weight</div>
                  <b className="tnum font-medium">{grams(t.quantityGrams)}</b>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-graphite-400">Rate/g</div>
                  <b className="tnum font-medium">{fmt(t.ratePerGram, t.currencyCode)}</b>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wide text-graphite-400">Total</div>
                  <b className="tnum font-medium text-graphite-900">{fmt(t.totalAmount, t.currencyCode)}</b>
                </div>
              </div>
              {t.counterparty && (
                <div className="mt-1.5 truncate text-[11.5px] text-graphite-400">{t.counterparty}</div>
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
                  <td className="px-5 py-3 text-graphite-600">{shortDate(t.date)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={t.type === "BUY" ? "amber" : "green"}>
                      {t.type === "BUY" ? "Purchase" : "Sale"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 font-medium text-graphite-700">{t.quality}</td>
                  <td className="px-5 py-3 text-right tnum">{grams(t.quantityGrams)}</td>
                  <td className="px-5 py-3 text-right tnum">{fmt(t.ratePerGram, t.currencyCode)}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="tnum font-medium">{fmt(t.totalAmount, t.currencyCode)}</div>
                    {t.currencyCode !== base.code && (
                      <div className="text-[11px] tnum text-graphite-400">
                        ≈ {fmt(t.totalAmount * t.fxRate)}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-graphite-500">{t.counterparty || "—"}</td>
                  <td className="px-5 py-3">{rowActions(t)}</td>
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
                onChange={(e) => setForm({ ...form, date: e.target.value })}
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
                onChange={(e) =>
                  setForm({
                    ...form,
                    currencyCode: e.target.value,
                    // pull today's saved rate for the chosen currency
                    fxRate: e.target.value === base.code ? "1" : String(byCode(e.target.value).rate),
                  })
                }
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
                hint={`Today's saved rate: ${byCode(form.currencyCode).rate} ${base.code} · updated ${relTime(
                  byCode(form.currencyCode).rateUpdatedAt
                )}. Override here if this trade used a different rate.`}
              >
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={form.fxRate}
                  onChange={(e) => setForm({ ...form, fxRate: e.target.value })}
                />
              </Field>
            )}
          </div>
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
