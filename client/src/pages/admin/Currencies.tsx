import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Currency } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, Spinner } from "../../components/ui";

export default function Currencies() {
  const { data, loading, error, reload } = useFetch<Currency[]>("/currencies");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [form, setForm] = useState({ code: "", symbol: "", decimals: "2" });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

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
        await api.put(`/currencies/${editing.id}`, { symbol: payload.symbol, decimals: payload.decimals });
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

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <>
      <PageHeader
        title="Currencies"
        subtitle="Currencies you can record a trade, expense or capital amount in. Amounts roll up to the base currency (AED) on every report using the FX rate you enter per record."
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> Add currency
          </Button>
        }
      />

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
                {c.isBase && <Badge tone="gold">base</Badge>}
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
