// Tracks whichever currency is currently flagged base — set once by
// CurrencyProvider whenever that changes, so `money()` never hardcodes one
// currency's symbol/decimals across a base-currency switch. Manual
// "symbol number" formatting (not Intl's currency style) since the base can
// be any currency code the admin defines, not necessarily a real ISO 4217 one.
let baseSymbol = "USD";
let baseFmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function setMoneyCurrency(symbol: string, decimals: number): void {
  baseSymbol = symbol;
  baseFmt = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${baseSymbol} ${baseFmt.format(n)}`;
}

export function grams(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(n)} g`;
}

export function num(n: number | null | undefined, dp = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en", { maximumFractionDigits: dp }).format(n);
}

export function pct(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${num(n, 2)}%`;
}

export function shortDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateInput(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}
