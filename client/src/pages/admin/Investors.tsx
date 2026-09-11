import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Copy,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  ShieldOff,
  ShieldCheck,
  Trash2,
  Check,
} from "lucide-react";
import { api, apiError } from "../../api";
import { useFetch } from "../../useApi";
import type { Investor, ReportSummary } from "../../types";
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
import { pct, shortDate } from "../../format";
import { useCurrency, relTime } from "../../currency";
import { useTeam } from "../../team";

interface ListResp {
  investors: Investor[];
  totalActiveShare: number;
}

type PartnerRow = { name: string; role: string; percentage: string };

const blank = {
  name: "",
  email: "",
  phone: "",
  capitalInvested: "",
  currencyCode: "AED",
  fxRate: "1",
  companyCutPct: "",
  notes: "",
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  partners: [] as PartnerRow[],
};

export default function Investors() {
  const navigate = useNavigate();
  const { currencies, base, byCode, fmt } = useCurrency();
  const { activeTeamId, activeTeam } = useTeam();
  const { data, loading, error, reload } = useFetch<ListResp>(
    activeTeamId ? `/investors?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );
  // Current P/L per active investor, to show a running balance next to capital.
  const { data: report } = useFetch<ReportSummary>(
    activeTeamId ? `/reports/summary?teamId=${activeTeamId}` : null,
    [activeTeamId]
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Investor | null>(null);
  const [form, setForm] = useState(blank);
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [credsFor, setCredsFor] = useState<Investor | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(blank);
    setFormErr("");
    setFormOpen(true);
  }
  function openEdit(inv: Investor) {
    setEditing(inv);
    setForm({
      name: inv.name,
      email: inv.email ?? "",
      phone: inv.phone ?? "",
      capitalInvested: String(inv.capitalInvested),
      currencyCode: inv.currencyCode ?? "AED",
      fxRate: String(inv.fxRate ?? 1),
      companyCutPct: inv.companyCutPct === null ? "" : String(inv.companyCutPct),
      notes: inv.notes ?? "",
      status: inv.status,
      partners: (inv.partners ?? []).map((p) => ({
        name: p.name,
        role: p.role ?? "",
        percentage: String(p.percentage),
      })),
    });
    setFormErr("");
    setFormOpen(true);
  }

  const partnerTotal = form.partners.reduce((s, p) => s + Number(p.percentage || 0), 0);
  const partnersValid = form.partners.length === 0 || Math.abs(partnerTotal - 100) < 0.1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!partnersValid) {
      setFormErr(`Profit partners must total 100% (currently ${partnerTotal.toFixed(2)}%).`);
      return;
    }
    // A blank fx-rate must never silently become "1" — that would record
    // foreign-currency capital as if it were 1:1 with the base currency.
    if (form.currencyCode !== base.code && !(Number(form.fxRate) > 0)) {
      setFormErr(`Enter the exchange rate (1 ${form.currencyCode} = ? ${base.code}) before saving.`);
      return;
    }
    setBusy(true);
    setFormErr("");
    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone,
        teamId: activeTeamId,
        capitalInvested: Number(form.capitalInvested || 0),
        currencyCode: form.currencyCode,
        fxRate: form.currencyCode === base.code ? 1 : Number(form.fxRate),
        companyCutPct: form.companyCutPct === "" ? null : Number(form.companyCutPct),
        notes: form.notes,
        status: form.status,
        partners: form.partners.map((p) => ({
          name: p.name.trim(),
          role: p.role.trim(),
          percentage: Number(p.percentage || 0),
        })),
      };
      if (editing) {
        await api.put(`/investors/${editing.id}`, payload);
      } else {
        const r = await api.post("/investors", payload);
        setCredsFor(r.data);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormErr(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function regenerate(inv: Investor) {
    if (
      !confirm(
        `Regenerate credentials for ${inv.name}? Their current username and password will stop working immediately.`
      )
    )
      return;
    try {
      const r = await api.post(`/investors/${inv.id}/regenerate-credentials`);
      setCredsFor(r.data);
      reload();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function toggleLogin(inv: Investor) {
    const next = inv.loginStatus === "INVALID" ? "ACTIVE" : "INVALID";
    if (
      !confirm(
        next === "INVALID"
          ? `Make ${inv.name}'s login invalid? They will not be able to sign in.`
          : `Re-activate ${inv.name}'s login?`
      )
    )
      return;
    try {
      await api.post(`/investors/${inv.id}/login-status`, { status: next });
      reload();
    } catch (err) {
      alert(apiError(err));
    }
  }

  async function remove(inv: Investor) {
    if (
      !confirm(
        `Delete ${inv.name}? This removes the investor and their login permanently.`
      )
    )
      return;
    try {
      await api.delete(`/investors/${inv.id}`);
      reload();
    } catch (err) {
      alert(apiError(err));
    }
  }

  if (!activeTeamId)
    return (
      <>
        <PageHeader title="Investors" subtitle="Investors belong to a team." />
        <Card>
          <p className="px-5 py-14 text-center text-sm text-graphite-400">
            No team selected. Create one on the <b className="text-graphite-600">Teams</b> page
            first, then add its investors here.
          </p>
        </Card>
      </>
    );
  if (loading) return <Spinner />;
  if (error) return <ErrorNote>{error}</ErrorNote>;

  const totalShare = data?.totalActiveShare ?? 0;
  const teamDefaultCut = activeTeam?.companyCutPct ?? 0;

  const splitById = new Map((report?.investorSplit ?? []).map((r) => [r.investorId, r]));
  const plById = new Map((report?.investorSplit ?? []).map((r) => [r.investorId, r.netShare]));

  /** Running balance (in the base currency) = capital converted to base + their
   *  net profit share to date. */
  const balanceLine = (inv: Investor) => {
    if (!report) return null;
    const pl = plById.get(inv.id) ?? 0;
    const balance = inv.capitalInvested * (inv.fxRate ?? 1) + pl;
    return (
      <span className="text-[11px] text-graphite-400">
        Balance{" "}
        <span className="tnum font-medium text-graphite-700">{fmt(balance)}</span>
        {Math.abs(pl) >= 0.01 && (
          <span className={`tnum ${pl > 0 ? "text-positive" : "text-negative"}`}>
            {" "}
            ({pl > 0 ? "+" : "−"}
            {fmt(Math.abs(pl))})
          </span>
        )}
      </span>
    );
  };

  /** Partner breakdown of an investor's share (from the report when available,
   *  otherwise just the configured percentages). */
  const partnersLine = (inv: Investor) => {
    if (!inv.partners || inv.partners.length === 0) return null;
    const rows = splitById.get(inv.id)?.partnerSplit;
    return (
      <div className="mt-1 space-y-0.5 text-[11px] text-graphite-400">
        {inv.partners.map((p, i) => {
          const amt = rows?.[i]?.share;
          return (
            <div key={p.id} className="flex justify-between gap-2">
              <span className="truncate">
                {p.name}
                {p.role ? ` · ${p.role}` : ""}{" "}
                <span className="text-graphite-500">{p.percentage}%</span>
              </span>
              {amt !== undefined && (
                <span className={`tnum ${amt < 0 ? "text-negative" : "text-graphite-600"}`}>
                  {fmt(amt)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const loginBadge = (inv: Investor) =>
    inv.loginStatus === "ACTIVE" ? (
      <Badge tone="green">active</Badge>
    ) : inv.loginStatus === "INVALID" ? (
      <Badge tone="red">invalid</Badge>
    ) : (
      <Badge tone="neutral">none</Badge>
    );

  const nameLink = (inv: Investor) => (
    <button
      onClick={() => navigate(`/admin/view/${inv.id}`)}
      className="text-left font-medium text-graphite-800 underline-offset-2 hover:text-accent-text hover:underline"
      title={`Open ${inv.name}'s portal`}
    >
      {inv.name}
    </button>
  );

  const rowActions = (inv: Investor) => (
    <div className="flex flex-wrap justify-end gap-1">
      <button
        onClick={() => navigate(`/admin/view/${inv.id}`)}
        title="View investor portal"
        className="mr-1 inline-flex h-9 items-center gap-1.5 rounded-full border border-graphite-200 bg-ink-800 px-3 text-[12px] font-semibold text-graphite-700 transition-colors hover:border-gold-lo hover:text-graphite-900"
      >
        <Eye size={13} /> View
      </button>
      <IconBtn title="Edit" onClick={() => openEdit(inv)}>
        <Pencil size={15} />
      </IconBtn>
      <IconBtn title="Regenerate credentials" onClick={() => regenerate(inv)}>
        <KeyRound size={15} />
      </IconBtn>
      <IconBtn
        title={inv.loginStatus === "INVALID" ? "Re-activate login" : "Make login invalid"}
        onClick={() => toggleLogin(inv)}
      >
        {inv.loginStatus === "INVALID" ? <ShieldCheck size={15} /> : <ShieldOff size={15} />}
      </IconBtn>
      <IconBtn title="Delete" danger onClick={() => remove(inv)}>
        <Trash2 size={15} />
      </IconBtn>
    </div>
  );

  const credsButton = (inv: Investor) =>
    inv.generatedPassword ? (
      <button
        onClick={() => setCredsFor(inv)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-graphite-500 underline decoration-dotted underline-offset-2 hover:text-accent-text"
      >
        <KeyRound size={11} /> Credentials not shared yet
      </button>
    ) : null;

  return (
    <>
      <PageHeader
        title="Investors"
        subtitle={`${activeTeam?.name ?? "This team"} · share % is derived from each member's capital; the company takes ${teamDefaultCut}% of each share by default.`}
        action={
          <Button onClick={openAdd}>
            <Plus size={16} /> Add investor
          </Button>
        }
      />

      <Card>
        <div className="flex items-center justify-between border-b border-graphite-100 px-5 py-2.5 text-xs text-graphite-500">
          <span>{data?.investors.length ?? 0} investors</span>
          <span>
            Active share total:{" "}
            <strong
              className={
                Math.abs(totalShare - 100) > 0.01 ? "text-warning" : "text-positive"
              }
            >
              {pct(totalShare)}
            </strong>
          </span>
        </div>
        {data?.investors.length === 0 && (
          <p className="px-4 py-14 text-center text-sm text-graphite-400">
            No investors yet. Click “Add investor” to create the first one.
          </p>
        )}

        {/* mobile: one card per investor */}
        <div className="divide-y divide-graphite-50 sm:hidden">
          {data?.investors.map((inv) => (
            <div key={inv.id} className="px-3.5 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div>{nameLink(inv)}</div>
                  <div className="text-xs text-graphite-400">
                    Joined {shortDate(inv.joinedAt)}
                    {inv.status === "INACTIVE" && (
                      <>
                        {" · "}
                        <Badge tone="neutral">inactive</Badge>
                      </>
                    )}
                  </div>
                </div>
                {loginBadge(inv)}
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
                <div>
                  <span className="text-graphite-400">Share </span>
                  <b className="tnum font-medium text-accent-text">{pct(inv.sharePercentage)}</b>
                  {inv.effectiveCompanyCutPct > 0 && (
                    <div className="text-[10px] text-graphite-400">
                      co. cut {inv.effectiveCompanyCutPct}%
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-graphite-400">Capital </span>
                  <b className="tnum font-medium text-graphite-700">{fmt(inv.capitalInvested, inv.currencyCode)}</b>
                </div>
                {report && (
                  <div className="col-span-2 text-right">{balanceLine(inv)}</div>
                )}
                <div className="col-span-2 truncate text-[11.5px] text-graphite-400">
                  {inv.username} · {inv.email || "—"} · {inv.phone || "—"}
                </div>
              </div>
              {partnersLine(inv)}
              {inv.generatedPassword && <div className="mt-2">{credsButton(inv)}</div>}
              <div className="mt-2 border-t border-graphite-100 pt-1.5">{rowActions(inv)}</div>
            </div>
          ))}
        </div>

        {/* desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-graphite-100 text-left text-xs uppercase tracking-wide text-graphite-400">
                <th className="px-5 py-2.5 font-medium">Investor</th>
                <th className="px-5 py-2.5 font-medium">Contact</th>
                <th className="px-5 py-2.5 text-right font-medium">Share</th>
                <th className="px-5 py-2.5 text-right font-medium">Capital / balance</th>
                <th className="px-5 py-2.5 font-medium">Login</th>
                <th className="px-5 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite-50">
              {data?.investors.map((inv) => (
                <tr key={inv.id} className="hover:bg-graphite-50/60">
                  <td className="px-5 py-3">
                    <div>{nameLink(inv)}</div>
                    <div className="text-xs text-graphite-400">
                      Joined {shortDate(inv.joinedAt)}
                      {inv.status === "INACTIVE" && (
                        <>
                          {" · "}
                          <Badge tone="neutral">inactive</Badge>
                        </>
                      )}
                    </div>
                    {inv.generatedPassword && <div className="mt-1">{credsButton(inv)}</div>}
                  </td>
                  <td className="px-5 py-3 text-xs text-graphite-500">
                    {inv.email || "—"}
                    <br />
                    {inv.phone || "—"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="tnum font-medium text-accent-text">
                      {pct(inv.sharePercentage)}
                    </div>
                    {inv.effectiveCompanyCutPct > 0 && (
                      <div className="text-[11px] text-graphite-400">
                        co. cut {inv.effectiveCompanyCutPct}%
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="tnum text-graphite-600">{fmt(inv.capitalInvested, inv.currencyCode)}</div>
                    <div className="mt-0.5">{balanceLine(inv)}</div>
                    <div className="text-left">{partnersLine(inv)}</div>
                  </td>
                  <td className="px-5 py-3">
                    {loginBadge(inv)}
                    <div className="mt-0.5 text-[11px] text-graphite-400">{inv.username}</div>
                  </td>
                  <td className="px-5 py-3">{rowActions(inv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add / Edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add investor"}
      >
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Capital invested"
              required
              hint="Drives this member's profit share % across the team."
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.capitalInvested}
                onChange={(e) => setForm({ ...form, capitalInvested: e.target.value })}
              />
            </Field>
            <Field
              label="Company cut %"
              hint={`Blank = team default (${teamDefaultCut}%). The company takes this % of the member's profit share before their partner split.`}
            >
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder={`${teamDefaultCut} (team default)`}
                value={form.companyCutPct}
                onChange={(e) => setForm({ ...form, companyCutPct: e.target.value })}
              />
            </Field>
          </div>
          {editing && (
            <p className="rounded-lg bg-graphite-50 px-3 py-2 text-[11.5px] text-graphite-500">
              Current derived share:{" "}
              <b className="text-graphite-700">{pct(editing.sharePercentage)}</b> —
              recalculated from capital across the team when you save.
            </p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Capital currency">
              <select
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-graphite-900"
                value={form.currencyCode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currencyCode: e.target.value,
                    fxRate: e.target.value === base.code ? "1" : String(byCode(e.target.value).rate),
                  })
                }
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.symbol !== c.code ? `(${c.symbol})` : ""}
                  </option>
                ))}
              </select>
            </Field>
            {form.currencyCode !== base.code && (
              <Field
                label={`1 ${form.currencyCode} = ? ${base.code}`}
                hint={`Today's saved rate: ${byCode(form.currencyCode).rate} ${base.code} · updated ${relTime(
                  byCode(form.currencyCode).rateUpdatedAt
                )}`}
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
          {/* Profit partners — second-level split of this investor's share */}
          <div className="rounded-lg border border-graphite-100 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-graphite-500">Profit partners</span>
              {form.partners.length > 0 && (
                <span
                  className={`text-[11px] font-semibold ${
                    partnersValid ? "text-positive" : "text-warning"
                  }`}
                >
                  {partnerTotal.toFixed(2)}% {partnersValid ? "✓" : "— must total 100%"}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-graphite-400">
              Split this investor’s profit share between people (e.g. capital vs. the person
              working the investment). Leave empty if they keep 100%.
            </p>

            {form.partners.map((p, i) => (
              <div key={i} className="mt-2 rounded-lg border border-graphite-100 p-2">
                <Input
                  placeholder="Partner name"
                  value={p.name}
                  onChange={(e) => {
                    const next = [...form.partners];
                    next[i] = { ...p, name: e.target.value };
                    setForm({ ...form, partners: next });
                  }}
                />
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    placeholder="Role (optional)"
                    value={p.role}
                    onChange={(e) => {
                      const next = [...form.partners];
                      next[i] = { ...p, role: e.target.value };
                      setForm({ ...form, partners: next });
                    }}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder="%"
                    value={p.percentage}
                    onChange={(e) => {
                      const next = [...form.partners];
                      next[i] = { ...p, percentage: e.target.value };
                      setForm({ ...form, partners: next });
                    }}
                    className="w-20 text-right"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, partners: form.partners.filter((_, j) => j !== i) })
                    }
                    aria-label="Remove partner"
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  partners: [...form.partners, { name: "", role: "", percentage: "" }],
                })
              }
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-graphite-600 hover:text-accent-text"
            >
              <Plus size={13} /> Add partner
            </button>
          </div>

          {editing && (
            <Field label="Status" hint="Inactive also invalidates the login">
              <select
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-graphite-900"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as "ACTIVE" | "INACTIVE" })
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          )}
          <Field label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          {formErr && <ErrorNote>{formErr}</ErrorNote>}
          {!editing && (
            <p className="rounded-lg bg-graphite-50 px-3 py-2 text-xs text-graphite-500">
              A username and password will be generated automatically — you’ll see them
              once, right after saving.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !partnersValid}>
              {busy ? "Saving…" : editing ? "Save changes" : "Create investor"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Credentials reveal modal */}
      <CredentialsModal
        investor={credsFor}
        onClose={() => setCredsFor(null)}
        onAck={async (inv) => {
          try {
            await api.post(`/investors/${inv.id}/ack-credentials`);
          } catch {
            /* ignore */
          }
          setCredsFor(null);
          reload();
        }}
      />
    </>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-md transition-colors ${
        danger
          ? "text-graphite-400 hover:bg-red-500/10 hover:text-negative"
          : "text-graphite-400 hover:bg-graphite-100 hover:text-graphite-700"
      }`}
    >
      {children}
    </button>
  );
}

function CredentialsModal({
  investor,
  onClose,
  onAck,
}: {
  investor: Investor | null;
  onClose: () => void;
  onAck: (inv: Investor) => void;
}) {
  const [copied, setCopied] = useState("");
  if (!investor) return null;
  const username = investor.generatedUsername ?? investor.username ?? "";
  const password = investor.generatedPassword ?? "";

  const copy = (label: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 1500);
  };

  return (
    <Modal open={!!investor} onClose={onClose} title={`Credentials for ${investor.name}`}>
      <p className="text-sm text-graphite-500">
        Share these with {investor.name}. The password is shown{" "}
        <strong>only now</strong> — after you confirm it’s delivered it can’t be viewed
        again (you can always regenerate).
      </p>
      <div className="mt-4 space-y-2">
        <CredRow
          label="Username"
          value={username}
          onCopy={() => copy("Username", username)}
          copied={copied === "Username"}
        />
        <CredRow
          label="Password"
          value={password || "— regenerate to get a new one —"}
          onCopy={() => password && copy("Password", password)}
          copied={copied === "Password"}
        />
        <CredRow
          label="Login URL"
          value={`${location.origin}/login`}
          onCopy={() => copy("Login URL", `${location.origin}/login`)}
          copied={copied === "Login URL"}
        />
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        {password && (
          <Button onClick={() => onAck(investor)}>
            <Check size={16} /> I’ve shared these
          </Button>
        )}
      </div>
    </Modal>
  );
}

function CredRow({
  label,
  value,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-ink-600 bg-ink-900 px-3 py-2">
      <div>
        <div className="text-[11px] uppercase tracking-wide text-graphite-400">{label}</div>
        <div className="font-mono text-sm text-graphite-800">{value}</div>
      </div>
      <button
        onClick={onCopy}
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-graphite-500 hover:bg-graphite-100"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
