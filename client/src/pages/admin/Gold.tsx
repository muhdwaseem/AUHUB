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
  Spinner,
  Textarea,
} from "../../components/ui";
import { money, grams, shortDate, dateInput } from "../../format";

interface ListResp {
  transactions: GoldTxn[];
}

const blank = {
  type: "BUY" as "BUY" | "SELL",
  date: dateInput(),
  quality: "24K",
  quantityGrams: "",
  ratePerGram: "",
  counterparty: "",
  notes: "",
};

export default function Gold() {
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
        <div className="overflow-x-auto">
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
                  <td className="px-5 py-3 text-right tnum">{money(t.ratePerGram)}</td>
                  <td className="px-5 py-3 text-right tnum font-medium">
                    {money(t.totalAmount)}
                  </td>
                  <td className="px-5 py-3 text-xs text-graphite-500">
                    {t.counterparty || "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => openEdit(t)}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => remove(t)}
                        className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {data?.transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-14 text-center text-sm text-graphite-400">
                    No trades recorded.
                  </td>
                </tr>
              )}
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
          <div className="rounded-lg bg-gold-500/10 px-3 py-2 text-sm text-accent-text">
            Transaction total: <strong className="tnum">{money(preview)}</strong>
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
