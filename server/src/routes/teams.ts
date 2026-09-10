import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, adminRequired } from "../lib/auth.js";

export const teamsRouter = Router();
teamsRouter.use(authRequired);

const teamSchema = z.object({
  name: z.string().trim().min(1, "Team name is required"),
  companyCutPct: z.coerce.number().min(0).max(100).optional(),
});

function publicTeam(t: any) {
  return {
    id: t.id,
    name: t.name,
    companyCutPct: t.companyCutPct,
    createdAt: t.createdAt,
    counts: t._count
      ? {
          investors: t._count.investors,
          transactions: t._count.transactions,
          expenses: t._count.expenses,
        }
      : undefined,
  };
}

// List every team (any authenticated user — the client needs names to label
// scoped views; an investor just never sees a switcher).
teamsRouter.get("/", async (_req, res) => {
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { investors: true, transactions: true, expenses: true } },
    },
  });
  res.json(teams.map(publicTeam));
});

teamsRouter.post("/", adminRequired, async (req, res) => {
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  try {
    const team = await prisma.team.create({
      data: { name: parsed.data.name, companyCutPct: parsed.data.companyCutPct ?? 0 },
    });
    res.status(201).json(publicTeam(team));
  } catch {
    res.status(409).json({ error: "A team with that name already exists" });
  }
});

teamsRouter.put("/:id", adminRequired, async (req, res) => {
  const parsed = teamSchema.partial().safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid data" });
  try {
    const team = await prisma.team.update({
      where: { id: req.params.id },
      data: {
        name: parsed.data.name ?? undefined,
        companyCutPct: parsed.data.companyCutPct ?? undefined,
      },
    });
    res.json(publicTeam(team));
  } catch {
    res.status(404).json({ error: "Team not found" });
  }
});

teamsRouter.delete("/:id", adminRequired, async (req, res) => {
  const team = await prisma.team.findUnique({
    where: { id: req.params.id },
    include: {
      _count: { select: { investors: true, transactions: true, expenses: true } },
    },
  });
  if (!team) return res.status(404).json({ error: "Team not found" });
  if (team._count.investors || team._count.transactions || team._count.expenses)
    return res.status(400).json({
      error: "Delete this team's investors, trades and expenses first",
    });
  await prisma.team.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
