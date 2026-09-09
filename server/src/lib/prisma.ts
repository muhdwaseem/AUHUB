import { PrismaClient } from "../generated/prisma/index.js";

// Reuse one client across warm serverless invocations (and dev HMR) so we don't
// open a new pool on every request.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["error"] : ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
