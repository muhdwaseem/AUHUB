import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Category } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { Badge, Button, Card, ErrorNote, Field, Input, Modal, Spinner } from "../../components/ui";

export default function Categories() {
  const { data, loading, error, reload } = useFetch<Category[]>("/expense-categories");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setName("");
    setFormErr("");
    setOpen(true);
  }
  function openEdit(c: Category) {
    setEditing(c);
    setName(c.name);
    setFormErr("");
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr("");
    try {
      if (editing) await api.put(`/expense-categories/${editing.id}`, { name });
      else await api.post("/expense-categories", { name });
      setOpen(false);
      reload();
    } catch (err) {
      setFormErr(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Delete the "${c.name}" header?`)) return;
    try {
      await api.delete(`/expense-categories/${c.id}`);
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
        title="Expense Headers"
        subtitle="The categories used when recording an expense. Flight, Total Travel, Visa and Hotel Bookings come built-in."
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> Add header
          </Button>
        }
      />

      <Card>
        <div className="divide-y divide-graphite-50">
          {data?.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-medium text-graphite-800">{c.name}</span>
                {c.isDefault && <Badge tone="gold">built-in</Badge>}
                <span className="text-xs text-graphite-400">
                  {c.expenseCount} expense{c.expenseCount === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => openEdit(c)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => remove(c)}
                  className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="px-5 py-14 text-center text-sm text-graphite-400">
              No headers yet.
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Rename header" : "Add expense header"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Header name" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="e.g. Customs Duty"
            />
          </Field>
          {formErr && <ErrorNote>{formErr}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save" : "Add header"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
