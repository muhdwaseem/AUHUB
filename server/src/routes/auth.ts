import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authRequired, signToken, pwdStamp } from "../lib/auth.js";

export const authRouter = Router();

// Best-effort brute-force slowdown on sign-in. On serverless the counter lives
// in per-instance memory (no shared store), so it's a speed bump under spread
// load rather than a hard lock — still worth having. Only failed attempts count.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Wait a few minutes and try again." },
});

// Throttle other credential-sensitive mutations (password change, etc.).
const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Wait a few minutes and try again." },
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
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
    pv: pwdStamp(user.password),
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
  newPassword: z.string().min(12),
});

authRouter.post("/change-password", sensitiveLimiter, authRequired, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "New password must be at least 12 characters" });
  if (parsed.data.newPassword === parsed.data.currentPassword)
    return res.status(400).json({ error: "New password must be different from the current one" });
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
