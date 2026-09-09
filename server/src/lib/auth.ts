import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "insecure-dev-secret";

export interface TokenPayload {
  userId: string;
  role: "ADMIN" | "INVESTOR";
  investorId?: string | null;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });
}

export function authRequired(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    req.auth = jwt.verify(token, JWT_SECRET) as TokenPayload;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
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
