import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { api } from "./api";
import { useFetch } from "./useApi";
import { setMoneyCurrency } from "./format";
import type { Currency, CurrencyRateOn } from "./types";

const FALLBACK_BASE: Currency = {
  id: "",
  code: "USD",
  symbol: "$",
  decimals: 2,
  isBase: true,
  rate: 1,
  rateUpdatedAt: null,
  createdAt: "",
};

/** Describe where a date-resolved rate came from, for a form's fx-rate hint.
 *  Only an exact match is ever put into the field itself — anything else is
 *  reference text only, so a rate never gets silently carried from another
 *  day into a record priced on a day it was never actually set for. */
export function rateHint(
  info: CurrencyRateOn | null | undefined,
  date: string,
  baseCode: string
): string {
  if (!info) return "";
  if (info.exact) return `Rate for ${date}: ${info.rate} ${baseCode}`;
  if (info.resolvedDate)
    return `No rate saved for ${date} — enter it below (for reference, ${info.resolvedDate}'s rate was ${info.rate} ${baseCode})`;
  return `No rate ever saved for this currency yet — enter it below.`;
}

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
  /** Every currency's rate as of `date` (yyyy-mm-dd), falling back to the
   *  nearest earlier saved rate. Cached per date for the life of the page. */
  rateOn: (date: string) => Promise<CurrencyRateOn[]>;
  /** Re-fetch the currency list. The Currencies admin page keeps its own
   *  separate fetch for its management table — call this too after any
   *  add/edit/delete/rate-save so every other page (trade/expense/investor
   *  forms) picks up the change immediately instead of only after a full
   *  page reload. */
  reload: () => void;
}

const Ctx = createContext<CurrencyCtx>(null as any);
export const useCurrency = () => useContext(Ctx);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useFetch<Currency[]>("/currencies");
  const currencies = data && data.length > 0 ? data : [FALLBACK_BASE];
  const base = currencies.find((c) => c.isBase) ?? currencies[0];
  const rateOnCache = useRef(new Map<string, Promise<CurrencyRateOn[]>>());

  // Keep money()'s formatter (used outside this context, e.g. in Dashboard's
  // report summaries) tracking whichever currency is actually base.
  useEffect(() => {
    setMoneyCurrency(base.symbol, base.decimals);
  }, [base.symbol, base.decimals]);

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

  const rateOn = (date: string) => {
    if (!rateOnCache.current.has(date)) {
      rateOnCache.current.set(
        date,
        api
          .get<CurrencyRateOn[]>(`/currencies/rates-on?date=${date}`)
          .then((r) => r.data)
          .catch(() => [])
      );
    }
    return rateOnCache.current.get(date)!;
  };

  return (
    <Ctx.Provider value={{ currencies, base, byCode, fmt, rateOn, reload }}>{children}</Ctx.Provider>
  );
}
