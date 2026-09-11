import { prisma } from "./prisma.js";

/** The currency every report/total is expressed in. Exactly one row has
 *  isBase = true. Used wherever a route needs "the base currency" as a
 *  default rather than a client-supplied code, so it always tracks whichever
 *  currency is actually flagged base instead of a hardcoded one. */
export async function getBaseCurrencyCode(): Promise<string> {
  const base = await prisma.currency.findFirst({ where: { isBase: true } });
  return base?.code ?? "AED";
}
