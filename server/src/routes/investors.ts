import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";
import { makePassword, makeUsername } from "../lib/credentials.js";

export const investorsRouter = Router();
investorsRouter.use(authRequired, adminRequired);

const partnerSchema = z.object({
  name: z.string().trim().min(1, "Partner name is required"),
  role: z.string().trim().optional().or(z.literal("")),
  percentage: z.coerce.number().min(0).max(100),
});

const investorSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  sharePercentage: z.coerce.number().min(0).max(100),
  capitalInvested: z.coerce.number().min(0).optional(),
  currencyCode: z.string().trim().toUpperCase().optional(),
  fxRate: z.coerce.number().positive().optional(),
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

function publicInvestor(inv: any) {
  return {
    id: inv.id,
    name: inv.name,
    email: inv.email,
    phone: inv.phone,
    sharePercentage: inv.sharePercentage,
    capitalInvested: inv.capitalInvested,
    currencyCode: inv.currencyCode ?? "AED",
    fxRate: inv.fxRate ?? 1,
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

// List
investorsRouter.get("/", async (_req, res) => {
  const investors = await prisma.investor.findMany({
    include: { user: true, partners: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const totalShare = investors
    .filter((i) => i.status === "ACTIVE")
    .reduce((s, i) => s + i.sharePercentage, 0);
  res.json({ investors: investors.map(publicInvestor), totalActiveShare: totalShare });
});

// Get one
investorsRouter.get("/:id", async (req, res) => {
  const inv = await prisma.investor.findUnique({
    where: { id: req.params.id },
    include: { user: true, partners: { orderBy: { createdAt: "asc" } } },
  });
  if (!inv) return res.status(404).json({ error: "Investor not found" });
  res.json(publicInvestor(inv));
});

// Create (auto-generates a login)
investorsRouter.post("/", async (req, res) => {
  const parsed = investorSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });

  const d = parsed.data;
  const cur = await resolveCurrency(d.currencyCode ?? "AED", d.fxRate);
  if (!cur) return res.status(400).json({ error: `Unknown currency "${d.currencyCode}"` });
  const partnerErr = validatePartners(d.partners);
  if (partnerErr) return res.status(400).json({ error: partnerErr });
  const username = makeUsername(d.name);
  const password = makePassword();
  const hash = await bcrypt.hash(password, 10);

  const inv = await prisma.investor.create({
    data: {
      name: d.name,
      email: d.email || null,
      phone: d.phone || null,
      sharePercentage: d.sharePercentage,
      capitalInvested: d.capitalInvested ?? 0,
      currencyCode: cur.code,
      fxRate: cur.fxRate,
      notes: d.notes || null,
      status: d.status ?? "ACTIVE",
      generatedUsername: username,
      generatedPassword: password,
      user: {
        create: { username, password: hash, role: "INVESTOR", status: "ACTIVE" },
      },
      partners: { create: partnerData(d.partners) },
    },
    include: { user: true, partners: { orderBy: { createdAt: "asc" } } },
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
      sharePercentage: d.sharePercentage ?? undefined,
      capitalInvested: d.capitalInvested ?? undefined,
      currencyCode,
      fxRate,
      notes: d.notes === undefined ? undefined : d.notes || null,
      status: d.status ?? undefined,
      // Replace-all: only touch partners when the client sends the array.
      ...(d.partners !== undefined
        ? { partners: { deleteMany: {}, create: partnerData(d.partners) } }
        : {}),
    },
    include: { user: true },
  });

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
        include: { user: true, partners: { orderBy: { createdAt: "asc" } } },
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
    include: { user: true },
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

// Delete (also removes the login, cascade)
investorsRouter.delete("/:id", async (req, res) => {
  const inv = await prisma.investor.findUnique({ where: { id: req.params.id } });
  if (!inv) return res.status(404).json({ error: "Investor not found" });
  await prisma.investor.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
