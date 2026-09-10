import { createContext, useContext, type ReactNode } from "react";
import { useFetch } from "./useApi";
import type { Currency } from "./types";

const FALLBACK_BASE: Currency = {
  id: "",
  code: "AED",
  symbol: "AED",
  decimals: 2,
  isBase: true,
  createdAt: "",
};

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
