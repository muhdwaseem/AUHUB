import { FormEvent, useState } from "react";
import { Pencil, Plus, Trash2, Users, Coins, ReceiptText } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Team } from "../../types";
import { PageHeader } from "../../components/AppShell";
import { useTeam } from "../../team";
import { Button, Card, ErrorNote, Field, Input, Modal, Spinner } from "../../components/ui";

export default function Teams() {
  const { data, loading, error, reload } = useFetch<Team[]>("/teams");
  const { reload: reloadCtx, setActiveTeam } = useTeam();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [form, setForm] = useState({ name: "", companyCutPct: "0" });
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", companyCutPct: "0" });
    setFormErr("");
    setOpen(true);
  }
  function openEdit(t: Team) {
    setEditing(t);
    setForm({ name: t.name, companyCutPct: String(t.companyCutPct) });
    setFormErr("");
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr("");
    try {
      const payload = {
        name: form.name.trim(),
        companyCutPct: Number(form.companyCutPct || 0),
      };
      if (editing) {
        await api.put(`/teams/${editing.id}`, payload);
      } else {
        const r = await api.post<Team>("/teams", payload);
        setActiveTeam(r.data.id);
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

  async function remove(t: Team) {
    if (!confirm(`Delete the team "${t.name}"?`)) return;
    try {
      await api.delete(`/teams/${t.id}`);
      reload();
      reloadCtx();
    } catch (err) {
      alert(apiError(err));
    }
  }

  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  return (
    <>
      <PageHeader
        title="Teams"
        subtitle="Each team is its own book — its own investors, capital, gold trades, stock and profit/loss. One team's activity never touches another's."
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> Add team
          </Button>
        }
      />

      <Card>
        <div className="divide-y divide-graphite-50">
          {data?.map((t) => (
            <div key={t.id} className="px-3.5 py-3.5 sm:px-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-serif text-[15px] font-semibold text-graphite-900">
                    {t.name}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-graphite-400">
                    <span className="inline-flex items-center gap-1">
                      <Users size={12} /> {t.counts?.investors ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Coins size={12} /> {t.counts?.transactions ?? 0} trades
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <ReceiptText size={12} /> {t.counts?.expenses ?? 0} expenses
                    </span>
                    <span className="text-graphite-500">
                      Company cut{" "}
                      <b className="font-mono text-graphite-700">{t.companyCutPct}%</b>{" "}
                      (default)
                    </span>
                  </div>
                </div>
                <div className="flex flex-none gap-1">
                  <button
                    onClick={() => openEdit(t)}
                    aria-label="Edit team"
                    className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => remove(t)}
                    aria-label="Delete team"
                    className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {data?.length === 0 && (
            <div className="px-5 py-14 text-center text-sm text-graphite-400">
              No teams yet.
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add team"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Team name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
              placeholder="AU Investors – Team 2"
            />
          </Field>
          <Field
            label="Default company cut %"
            hint="The % the company takes from each member's profit share before their working/capital split. A member can override this on their own record."
          >
            <Input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.companyCutPct}
              onChange={(e) => setForm({ ...form, companyCutPct: e.target.value })}
            />
          </Field>
          {formErr && <ErrorNote>{formErr}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save" : "Add team"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
