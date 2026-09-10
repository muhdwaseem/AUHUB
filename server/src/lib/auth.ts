import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./prisma.js";

// In production a missing JWT_SECRET must be fatal — falling back to a known
// string would let anyone forge an admin token. Only dev gets the placeholder.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set — refusing to start with a known signing key");
}
const JWT_SECRET = process.env.JWT_SECRET || "insecure-dev-secret";

// A working-day session. Shorter than before (was 12h); a stale token is also
// killed the moment the account's password changes or the login is disabled.
const SESSION_TTL = "8h";

export interface TokenPayload {
  userId: string;
  role: "ADMIN" | "INVESTOR";
  investorId?: string | null;
  username: string;
  /** Short fingerprint of the password hash when the token was issued. If the
   *  password later changes (or the row is gone) every old token stops working. */
  pv?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/** 16-hex fingerprint of a bcrypt hash — embedded in the token, re-checked per request. */
export function pwdStamp(passwordHash: string): string {
  return createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: SESSION_TTL, algorithm: "HS256" });
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] }) as TokenPayload;
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }

  // Revocation check: password change / account disable ends every live session.
  if (payload.pv) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { password: true, status: true },
      });
      if (!user || user.status === "INVALID" || pwdStamp(user.password) !== payload.pv) {
        return res.status(401).json({ error: "Session ended, please log in again" });
      }
    } catch {
      return res.status(503).json({ error: "Auth check failed, please retry" });
    }
  }

  req.auth = payload;
  next();
}

export function adminRequired(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN")
    return res.status(403).json({ error: "Admin access required" });
  next();
}

export function investorRequired(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "INVESTOR" || !req.auth.investorId)
    return res.status(403).json({ error: "Investor access required" });
  next();
}
