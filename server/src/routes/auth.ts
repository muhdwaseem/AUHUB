import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, signToken } from "../lib/auth.js";

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Username and password are required" });

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
    include: { investor: true },
  });
  if (!user) return res.status(401).json({ error: "Invalid username or password" });
  if (user.status === "INVALID")
    return res.status(403).json({ error: "This account has been disabled by the administrator" });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: "Invalid username or password" });

  const token = signToken({
    userId: user.id,
    role: user.role as "ADMIN" | "INVESTOR",
    investorId: user.investorId,
    username: user.username,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      investor: user.investor
        ? { id: user.investor.id, name: user.investor.name, sharePercentage: user.investor.sharePercentage }
        : null,
    },
  });
});

authRouter.get("/me", authRequired, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    include: { investor: true },
  });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    investor: user.investor
      ? { id: user.investor.id, name: user.investor.name, sharePercentage: user.investor.sharePercentage }
      : null,
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

authRouter.post("/change-password", authRequired, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "New password must be at least 6 characters" });
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });
  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  res.json({ ok: true });
});
