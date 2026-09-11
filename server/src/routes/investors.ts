import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";
import { makePassword, makeUsername } from "../lib/credentials.js";
import { getBaseCurrencyCode } from "../lib/currency.js";

export const investorsRouter = Router();
investorsRouter.use(authRequired, adminRequired);

const round2 = (n: number) => Math.round(n * 100) / 100;

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Partner name is required"),
  role: z.string().trim().optional().or(z.literal("")),
  percentage: z.coerce.number().min(0).max(100),
});

const investorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  /** The team this investor belongs to. Required on create. */
  teamId: z.string().trim().min(1).optional(),
  /** Capital drives the share — the % is derived, never sent by the client. */
  capitalInvested: z.coerce.number().min(0).optional(),
  currencyCode: z.string().trim().toUpperCase().optional(),
  fxRate: z.coerce.number().positive().optional(),
  /** Per-member override of the team's company cut %. null = inherit the team
   *  default; undefined (on PUT) = leave unchanged. */
  companyCutPct: z.coerce.number().min(0).max(100).nullable().optional(),
  notes: z.string().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  /** Second-level profit split. Empty = investor keeps 100% of their share. */
  partners: z.array(partnerSchema).optional(),
});

/** Returns an error string if the partner list is present but doesn't total 100%. */
function validatePartners(partners: z.infer<typeof partnerSchema>[] | undefined): string | null {
  if (!partners || partners.length === 0) return null;
  const total = partners.reduce((s, p) => s + (p.percentage || 0), 0);
  if (Math.abs(total - 100) > 0.1)
    return `Profit partners must total 100% (currently ${total.toFixed(2)}%).`;
  return null;
}

const partnerData = (partners: z.infer<typeof partnerSchema>[] | undefined) =>
  (partners ?? []).map((p) => ({
    name: p.name,
    role: p.role ? p.role : null,
    percentage: p.percentage,
  }));

async function resolveCurrency(code: string, fxRate?: number) {
  const cur = await prisma.currency.findUnique({ where: { code } });
  if (!cur) return null;
  return { code: cur.code, fxRate: cur.isBase ? 1 : (fxRate ?? cur.rate) };
}

/**
 * Recompute every member's sharePercentage for a team as their capital (in the
 * base currency) ÷ the team's total capital. The last member (by join order)
 * absorbs the rounding remainder so an all-members total is exactly 100.
 */
async function recomputeShares(teamId: string) {
  const members = await prisma.investor.findMany({
    where: { teamId },
    orderBy: { createdAt: "asc" },
  });
  const base = (m: { capitalInvested: number; fxRate: number | null }) =>
    (m.capitalInvested || 0) * (m.fxRate ?? 1);
  const totalCapital = members.reduce((s, m) => s + base(m), 0);

  let allocated = 0;
  const updates = members.map((m, idx) => {
    const isLast = idx === members.length - 1;
    let pct = 0;
    if (totalCapital > 0) {
      pct = isLast ? round2(100 - allocated) : round2((base(m) / totalCapital) * 100);
    }
    allocated = round2(allocated + pct);
    return prisma.investor.update({
      where: { id: m.id },
      data: { sharePercentage: pct },
    });
  });
  if (updates.length) await prisma.$transaction(updates);
}

function publicInvestor(inv: any) {
  const teamDefault = inv.team?.companyCutPct ?? 0;
  return {
    id: inv.id,
    name: inv.name,
    email: inv.email,
    phone: inv.phone,
    teamId: inv.teamId,
    sharePercentage: inv.sharePercentage, // derived, read-only
    capitalInvested: inv.capitalInvested,
    currencyCode: inv.currencyCode ?? "AED",
    fxRate: inv.fxRate ?? 1,
    companyCutPct: inv.companyCutPct ?? null, // the member's own override, or null
    effectiveCompanyCutPct: inv.companyCutPct ?? teamDefault,
    teamCompanyCutPct: teamDefault,
    status: inv.status,
    notes: inv.notes,
    joinedAt: inv.joinedAt,
    partners: (inv.partners ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      role: p.role ?? null,
      percentage: p.percentage,
    })),
    loginStatus: inv.user?.status ?? null,
    username: inv.user?.username ?? null,
    // credentials to hand over (present right after create / regenerate)
    generatedUsername: inv.generatedUsername,
    generatedPassword: inv.generatedPassword,
  };
}

const withRelations = {
  user: true,
  team: true,
  partners: { orderBy: { createdAt: "asc" as const } },
};

// List — scoped to a team when ?teamId= is given
investorsRouter.get("/", async (req, res) => {
  const teamId = (req.query.teamId as string) || undefined;
  const investors = await prisma.investor.findMany({
    where: teamId ? { teamId } : undefined,
    include: withRelations,
    orderBy: { createdAt: "asc" },
  });
  const totalShare = investors
    .filter((i) => i.status === "ACTIVE")
    .reduce((s, i) => s + i.sharePercentage, 0);
  res.json({
    investors: investors.map(publicInvestor),
    totalActiveShare: Math.round(totalShare * 100) / 100,
  });
});

// Get one
investorsRouter.get("/:id", async (req, res) => {
  const inv = await prisma.investor.findUnique({
    where: { id: req.params.id },
    include: withRelations,
  });
  if (!inv) return res.status(404).json({ error: "Investor not found" });
  res.json(publicInvestor(inv));
});

// Create (auto-generates a login, then recomputes the team's shares)
investorsRouter.post("/", async (req, res) => {
  const parsed = investorSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });

  const d = parsed.data;
  if (!d.teamId) return res.status(400).json({ error: "A team is required" });
  const team = await prisma.team.findUnique({ where: { id: d.teamId } });
  if (!team) return res.status(400).json({ error: "Selected team not found" });

  const cur = await resolveCurrency(d.currencyCode ?? (await getBaseCurrencyCode()), d.fxRate);
  if (!cur) return res.status(400).json({ error: `Unknown currency "${d.currencyCode}"` });
  const partnerErr = validatePartners(d.partners);
  if (partnerErr) return res.status(400).json({ error: partnerErr });

  const username = makeUsername(d.name);
  const password = makePassword();
  const hash = await bcrypt.hash(password, 10);

  const created = await prisma.investor.create({
    data: {
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      teamId: d.teamId,
      sharePercentage: 0, // set by recomputeShares below
      capitalInvested: d.capitalInvested ?? 0,
      currencyCode: cur.code,
      fxRate: cur.fxRate,
      companyCutPct: d.companyCutPct ?? null,
      notes: d.notes || null,
      status: d.status ?? "ACTIVE",
      generatedUsername: username,
      generatedPassword: password,
      user: {
        create: { username, password: hash, role: "INVESTOR", status: "ACTIVE" },
      },
      partners: { create: partnerData(d.partners) },
    },
  });

  await recomputeShares(d.teamId);

  const inv = await prisma.investor.findUnique({
    where: { id: created.id },
    include: withRelations,
  });
  res.status(201).json(publicInvestor(inv));
});

// Update
investorsRouter.put("/:id", async (req, res) => {
  const parsed = investorSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  const existing = await prisma.investor.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Investor not found" });

  const d = parsed.data;

  if (d.teamId && d.teamId !== existing.teamId) {
    const team = await prisma.team.findUnique({ where: { id: d.teamId } });
    if (!team) return res.status(400).json({ error: "Selected team not found" });
  }

  let currencyCode: string | undefined;
  let fxRate: number | undefined;
  if (d.currencyCode !== undefined || d.fxRate !== undefined) {
    const cur = await resolveCurrency(
      d.currencyCode ?? existing.currencyCode,
      d.fxRate ?? existing.fxRate
    );
    if (!cur) return res.status(400).json({ error: `Unknown currency "${d.currencyCode}"` });
    currencyCode = cur.code;
    fxRate = cur.fxRate;
  }

  if (d.partners !== undefined) {
    const partnerErr = validatePartners(d.partners);
    if (partnerErr) return res.status(400).json({ error: partnerErr });
  }

  const inv = await prisma.investor.update({
    where: { id: req.params.id },
    data: {
      name: d.name ?? undefined,
      email: d.email === undefined ? undefined : d.email || null,
      phone: d.phone === undefined ? undefined : d.phone || null,
      teamId: d.teamId ?? undefined,
      capitalInvested: d.capitalInvested ?? undefined,
      currencyCode,
      fxRate,
      companyCutPct: d.companyCutPct === undefined ? undefined : d.companyCutPct,
      notes: d.notes === undefined ? undefined : d.notes || null,
      status: d.status ?? undefined,
      // Replace-all: only touch partners when the client sends the array.
      ...(d.partners !== undefined
        ? { partners: { deleteMany: {}, create: partnerData(d.partners) } }
        : {}),
    },
    include: { user: true },
  });

  // Any change to capital / fx / status / team shifts the derived shares.
  const teamsToRecompute = new Set<string>();
  if (existing.teamId) teamsToRecompute.add(existing.teamId);
  if (inv.teamId) teamsToRecompute.add(inv.teamId);
  for (const t of teamsToRecompute) await recomputeShares(t);

  // Keep the login in sync when the investor is deactivated / reactivated.
  if (d.status && inv.user) {
    await prisma.user.update({
      where: { id: inv.user.id },
      data: { status: d.status === "INACTIVE" ? "INVALID" : "ACTIVE" },
    });
  }

  res.json(
    publicInvestor(
      await prisma.investor.findUnique({
        where: { id: inv.id },
        include: withRelations,
      })
    )
  );
});

// Regenerate credentials (old password stops working immediately)
investorsRouter.post("/:id/regenerate-credentials", async (req, res) => {
  const inv = await prisma.investor.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!inv) return res.status(404).json({ error: "Investor not found" });

  const username = makeUsername(inv.name);
  const password = makePassword();
  const hash = await bcrypt.hash(password, 10);

  if (inv.user) {
    await prisma.user.update({
      where: { id: inv.user.id },
      data: { username, password: hash, status: "ACTIVE" },
    });
  } else {
    await prisma.user.create({
      data: { username, password: hash, role: "INVESTOR", status: "ACTIVE", investorId: inv.id },
    });
  }

  const updated = await prisma.investor.update({
    where: { id: inv.id },
    data: { generatedUsername: username, generatedPassword: password },
    include: withRelations,
  });
  res.json(publicInvestor(updated));
});

// Invalidate / re-activate the login without deleting the investor
investorsRouter.post("/:id/login-status", async (req, res) => {
  const schema = z.object({ status: z.enum(["ACTIVE", "INVALID"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "status must be ACTIVE or INVALID" });
  const inv = await prisma.investor.findUnique({
    where: { id: req.params.id },
    include: { user: true },
  });
  if (!inv?.user) return res.status(404).json({ error: "No login for this investor" });
  await prisma.user.update({ where: { id: inv.user.id }, data: { status: parsed.data.status } });
  res.json({ ok: true, loginStatus: parsed.data.status });
});

// Mark generated credentials as handed over (hides them from the UI)
investorsRouter.post("/:id/ack-credentials", async (req, res) => {
  const inv = await prisma.investor.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: "Investor not found" });
  await prisma.investor.update({
    where: { id: inv.id },
    data: { generatedPassword: null },
  });
  res.json({ ok: true });
});

// Delete (also removes the login, cascade) then rebalance the team's shares
investorsRouter.delete("/:id", async (req, res) => {
  const inv = await prisma.investor.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: "Investor not found" });
  await prisma.investor.delete({ where: { id: req.params.id } });
  if (inv.teamId) await recomputeShares(inv.teamId);
  res.json({ ok: true });
});
