import { FormEvent, useRef, useState } from "react";
import { Paperclip, Pencil, Plus, Trash2, Upload, User, X } from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Category, Expense, Investor } from "../../types";
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
import { AttachmentLink } from "../../components/AttachmentLink";
import { shortDate, dateInput } from "../../format";
import { useCurrency, rateHint } from "../../currency";
import type { CurrencyRateOn } from "../../types";
import { useTeam } from "../../team";
import { ConversionHops, type HopRow } from "../../components/ConversionHops";

interface ListResp {
  expenses: Expense[];
  total: number;
}
interface InvestorsResp {
  investors: Investor[];
}

const blankForm = {
  categoryId: "",
  amount: "",
  currencyCode: "AED",
  fxRate: "1",
  date: dateInput(),
  description: "",
  investorId: "",
  chargedToInvestor: false,
  hops: [] as HopRow[],
};

export default function Expenses() {
  const { currencies, base, fmt, rateOn } = useCurrency();
  const { activeTeamId, activeTeam } = useTeam();
  const [catFilter, setCatFilter] = useState("");
  const { data: cats } = useFetch<Category[]>("/expense-categories");
  const { data: investorsResp } = useFetch<InvestorsResp>(
    activeTeamId ? `/investors?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );
  const investors = investorsResp?.investors ?? [];
  const { data, loading, error, reload } = useFetch<ListResp>(
    activeTeamId
      ? `/expenses?teamId=${activeTeamId}${catFilter ? `&categoryId=${catFilter}` : ""}`
      : null,
    [catFilter, activeTeamId]
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(blankForm);
  const [files, setFiles] = useState<File[]>([]);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // See Gold.tsx for the same pattern: resolves the fx rate for the form's own
  // date, only auto-fills fxRate on an explicit date/currency change.
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
    setForm({ ...blankForm, categoryId: cats?.[0]?.id ?? "" });
    setFiles([]);
    setFormErr("");
    setDateRateInfo(null);
    setOpen(true);
  }
  function openEdit(e: Expense) {
    setEditing(e);
    const date = e.date.slice(0, 10);
    setForm({
      categoryId: e.categoryId,
      amount: String(e.amount),
      currencyCode: e.currencyCode ?? "AED",
      fxRate: String(e.fxRate ?? 1),
      date,
      description: e.description ?? "",
      investorId: e.investorId ?? "",
      chargedToInvestor: e.chargedToInvestor,
      hops: (e.hops ?? []).map((h) => ({
        fromCurrency: h.fromCurrency,
        fromAmount: String(h.fromAmount),
        toCurrency: h.toCurrency,
        toAmount: String(h.toAmount),
        date: h.date.slice(0, 10),
        notes: h.notes ?? "",
      })),
    });
    setFiles([]);
    setFormErr("");
    refreshRateInfo(date, e.currencyCode ?? "AED", false);
    setOpen(true);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormErr("");
    const charged = !!form.investorId && form.chargedToInvestor;
    const fxRate = form.currencyCode === base.code ? 1 : Number(form.fxRate || 1);
    const hops = form.hops.map((h, i) => ({
      order: i + 1,
      fromCurrency: h.fromCurrency,
      fromAmount: Number(h.fromAmount),
      toCurrency: h.toCurrency,
      toAmount: Number(h.toAmount),
      date: h.date,
      notes: h.notes,
    }));
    try {
      if (editing) {
        await api.put(`/expenses/${editing.id}`, {
          categoryId: form.categoryId,
          amount: Number(form.amount),
          currencyCode: form.currencyCode,
          fxRate,
          date: form.date,
          description: form.description,
          investorId: form.investorId || null,
          chargedToInvestor: charged,
          hops,
        });
        if (files.length) {
          const fd = new FormData();
          files.forEach((f) => fd.append("files", f));
          await api.post(`/expenses/${editing.id}/attachments`, fd);
        }
      } else {
        const fd = new FormData();
        fd.append("categoryId", form.categoryId);
        fd.append("teamId", activeTeamId ?? "");
        fd.append("amount", form.amount);
        fd.append("currencyCode", form.currencyCode);
        fd.append("fxRate", String(fxRate));
        fd.append("date", form.date);
        fd.append("description", form.description);
        fd.append("investorId", form.investorId || "");
        fd.append("chargedToInvestor", charged ? "true" : "false");
        fd.append("hops", JSON.stringify(hops));
        files.forEach((f) => fd.append("files", f));
        await api.post("/expenses", fd);
      }
      setOpen(false);
      reload();
    } catch (err) {
      setFormErr(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeExpense(e: Expense) {
    if (!confirm(`Delete this ${fmt(e.amount, e.currencyCode)} expense and its attachments?`)) return;
    try {
      await api.delete(`/expenses/${e.id}`);
      reload();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function removeAttachment(expenseId: string, attId: string) {
    if (!confirm("Remove this file?")) return;
    try {
      await api.delete(`/expenses/${expenseId}/attachments/${attId}`);
      reload();
    } catch (err) {
      alert(apiError(err));
    }
  }

  if (!activeTeamId)
    return (
      <>
        <PageHeader title="Expenses" subtitle="Expenses belong to a team." />
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

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle={`${activeTeam?.name ?? "This team"} · flights, travel, visa, hotels and custom headers. New expenses are filed under this team.`}
        action={
          <Button onClick={openAdd} disabled={!cats?.length}>
            <Plus size={16} /> Add expense
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setCatFilter("")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            catFilter === ""
              ? "bg-chrome-800 text-white"
              : "bg-ink-800 text-graphite-600 border border-ink-600 hover:bg-ink-700"
          }`}
        >
          All headers
        </button>
        {cats?.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatFilter(c.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              catFilter === c.id
                ? "bg-chrome-800 text-white"
                : "bg-ink-800 text-graphite-600 border border-ink-600 hover:bg-ink-700"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-graphite-100 px-3.5 py-2.5 sm:px-5 text-xs text-graphite-500">
          <span>{data?.expenses.length ?? 0} expenses</span>
          <span>
            Total: <strong className="text-graphite-700">{fmt(data?.total ?? 0)}</strong>
          </span>
        </div>
        <div className="divide-y divide-graphite-50">
          {data?.expenses.map((e) => (
            <div key={e.id} className="px-3.5 py-3.5 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-graphite-100 px-2 py-0.5 text-xs font-medium text-graphite-600">
                      {e.categoryName}
                    </span>
                    <span className="text-xs text-graphite-400">{shortDate(e.date)}</span>
                    {e.investorName && (
                      <Badge tone={e.chargedToInvestor ? "amber" : "neutral"}>
                        <User size={11} className="mr-1" />
                        {e.investorName}
                        {e.chargedToInvestor ? " · charged" : " · tagged"}
                      </Badge>
                    )}
                    {e.hops.length > 0 && (
                      <span className="rounded-full bg-graphite-100 px-1.5 py-0.5 text-[10px] font-medium text-graphite-500">
                        {e.hops.length}-step conversion
                      </span>
                    )}
                  </div>
                  {e.description && (
                    <p className="mt-1 text-sm text-graphite-600">{e.description}</p>
                  )}
                  {e.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.attachments.map((a) => (
                        <span key={a.id} className="group relative inline-flex">
                          <AttachmentLink
                            id={a.id}
                            name={a.originalName}
                            mimeType={a.mimeType}
                          />
                          <button
                            onClick={() => removeAttachment(e.id, a.id)}
                            title="Remove file"
                            className="ml-0.5 rounded p-0.5 text-graphite-300 hover:text-negative"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-right">
                    <span className="tnum block text-sm font-semibold text-graphite-800">
                      {fmt(e.amount, e.currencyCode)}
                    </span>
                    {e.currencyCode !== base.code && (
                      <span className="tnum block text-[11px] text-graphite-400">
                        ≈ {fmt(e.amount * e.fxRate)}
                      </span>
                    )}
                  </span>
                  <button
                    onClick={() => openEdit(e)}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => removeExpense(e)}
                    className="flex h-11 w-11 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {data?.expenses.length === 0 && (
            <div className="px-5 py-14 text-center text-sm text-graphite-400">
              {cats?.length
                ? "No expenses recorded."
                : "Add an expense header first (Expense Headers page)."}
            </div>
          )}
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit expense" : "Add expense"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Header" required>
              <select
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-graphite-900"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                {cats?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Amount" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                autoFocus
              />
            </Field>
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
          </div>
          {form.currencyCode !== base.code && (
            <Field
              label={`1 ${form.currencyCode} = ? ${base.code}`}
              required
              hint={
                (dateRateInfo ? rateHint(dateRateInfo, form.date, base.code) : "Checking the rate for this date…") +
                (Number(form.amount) > 0 && Number(form.fxRate) > 0
                  ? ` · ≈ ${fmt(Number(form.amount) * Number(form.fxRate))} in ${base.code}`
                  : "")
              }
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
          <ConversionHops
            hops={form.hops}
            onChange={(hops) => setForm({ ...form, hops })}
            currencies={currencies}
            baseCode={base.code}
            onApplyRate={(fromCurrency, rate) =>
              setForm((f) => ({ ...f, currencyCode: fromCurrency, fxRate: String(rate) }))
            }
          />
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          {/* Investor attribution */}
          <div className="rounded-lg border border-graphite-200 bg-graphite-50/60 p-3">
            <Field
              label="Related investor (optional)"
              hint="Leave blank for a normal shared expense"
            >
              <select
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-graphite-900"
                value={form.investorId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    investorId: e.target.value,
                    chargedToInvestor: e.target.value ? form.chargedToInvestor : false,
                  })
                }
              >
                <option value="">— none (shared expense) —</option>
                {investors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.sharePercentage}%)
                  </option>
                ))}
              </select>
            </Field>
            <label
              className={`mt-2 flex items-start gap-2 text-sm ${
                form.investorId ? "text-graphite-700" : "text-graphite-400"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5"
                disabled={!form.investorId}
                checked={form.chargedToInvestor}
                onChange={(e) =>
                  setForm({ ...form, chargedToInvestor: e.target.checked })
                }
              />
              <span>
                Charge this expense to that investor only
                <span className="block text-xs text-graphite-400">
                  On = deducted from their profit share alone. Off = just tagged for
                  reference; still split across everyone.
                </span>
              </span>
            </label>
          </div>

          <Field label="Payment slips / invoices" hint="Images or PDF, up to 15 MB each">
            <div
              onClick={() => fileRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-graphite-300 px-4 py-6 text-center hover:border-gold-400 hover:bg-gold-500/10"
            >
              <Upload size={20} className="text-graphite-400" />
              <span className="mt-1 text-sm text-graphite-500">Click to choose files</span>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) =>
                  setFiles([...files, ...Array.from(e.target.files ?? [])])
                }
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md bg-graphite-50 px-2.5 py-1.5 text-xs text-graphite-600"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Paperclip size={12} /> {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="text-graphite-400 hover:text-negative"
                    >
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Field>

          {formErr && <ErrorNote>{formErr}</ErrorNote>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add expense"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
