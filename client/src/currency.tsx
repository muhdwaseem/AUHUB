import { createContext, useContext, type ReactNode } from "react";
import { useFetch } from "./useApi";
import type { Currency } from "./types";

const FALLBACK_BASE: Currency = {
  id: "",
  code: "AED",
  symbol: "AED",
  decimals: 2,
  isBase: true,
  rate: 1,
  rateUpdatedAt: null,
  createdAt: "",
};

/** "3h ago" / "yesterday" / "2 days ago" / "just now" — coarse, for the rate age. */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

interface CurrencyCtx {
  currencies: Currency[];
  base: Currency;
  byCode: (code: string | null | undefined) => Currency;
  /** Format an amount. `code` selects the currency; omit it to use the base. */
  fmt: (amount: number | null | undefined, code?: string | null) => string;
}

const Ctx = createContext<CurrencyCtx>(null as any);
export const useCurrency = () => useContext(Ctx);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data } = useFetch<Currency[]>("/currencies");
  const currencies = data && data.length > 0 ? data : [FALLBACK_BASE];
  const base = currencies.find((c) => c.isBase) ?? currencies[0];

  const byCode = (code: string | null | undefined) =>
    currencies.find((c) => c.code === code) ?? base;

  const fmt = (amount: number | null | undefined, code?: string | null) => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
    const cur = code ? byCode(code) : base;
    const n = amount.toLocaleString("en-US", {
      minimumFractionDigits: cur.decimals,
      maximumFractionDigits: cur.decimals,
    });
    return `${cur.symbol} ${n}`;
  };

  return <Ctx.Provider value={{ currencies, base, byCode, fmt }}>{children}</Ctx.Provider>;
}
