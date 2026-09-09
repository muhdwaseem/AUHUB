const currencyFmt = new Intl.NumberFormat("en-AE", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 2,
});

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return currencyFmt.format(n);
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
