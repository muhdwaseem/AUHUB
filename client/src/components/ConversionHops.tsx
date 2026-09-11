import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "./ui";
import type { Currency } from "../types";

/** Form-state shape for one editable hop row (strings, like the rest of a form). */
export type HopRow = {
  fromCurrency: string;
  fromAmount: string;
  toCurrency: string;
  toAmount: string;
  date: string;
  notes: string;
};

export function blankHop(fromCode: string, toCode: string, date: string): HopRow {
  return { fromCurrency: fromCode, fromAmount: "", toCurrency: toCode, toAmount: "", date, notes: "" };
}

/** Chains every hop's toAmount/fromAmount together, or null if any hop is
 *  missing an amount. This is the effective rate from the FIRST hop's
 *  fromCurrency to the LAST hop's toCurrency. */
export function composeRate(hops: HopRow[]): number | null {
  if (hops.length === 0) return null;
  let rate = 1;
  for (const h of hops) {
    const from = Number(h.fromAmount);
    const to = Number(h.toAmount);
    if (!(from > 0) || !(to > 0)) return null;
    rate *= to / from;
  }
  return Math.round(rate * 1e9) / 1e9;
}

/**
 * Repeatable list of conversion steps attached to a trade or expense — e.g.
 * "10,000 THB -> 280 USDT" then "280 USDT -> 1,028 AED". Purely a paper
 * trail; if the chain happens to end in the base currency, the caller can
 * offer its composite rate as the record's own fx-rate (still just a
 * suggestion — never applied silently).
 */
export function ConversionHops({
  hops,
  onChange,
  currencies,
  baseCode,
  onApplyRate,
}: {
  hops: HopRow[];
  onChange: (hops: HopRow[]) => void;
  currencies: Currency[];
  baseCode: string;
  onApplyRate?: (fromCurrency: string, rate: number) => void;
}) {
  const update = (i: number, patch: Partial<HopRow>) => {
    const next = hops.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(hops.filter((_, j) => j !== i));
  const add = () => {
    const last = hops[hops.length - 1];
    const fromCode = last?.toCurrency || baseCode;
    const today = new Date().toISOString().slice(0, 10);
    onChange([...hops, blankHop(fromCode, baseCode, last?.date || today)]);
  };

  const composite = composeRate(hops);
  const endsInBase = hops.length > 0 && hops[hops.length - 1].toCurrency === baseCode;

  return (
    <div className="rounded-lg border border-graphite-100 p-3">
      <span className="text-xs font-medium text-graphite-500">Conversion trail (optional)</span>
      <p className="mt-0.5 text-[11px] text-graphite-400">
        How the money actually moved — e.g. paid in THB, converted to USDT, then to {baseCode}.
        Doesn't change the accounting on its own; it's a record of each step.
      </p>

      {hops.map((h, i) => (
        <div key={i} className="mt-2 rounded-lg border border-graphite-100 p-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-graphite-500">
            <span>Step {i + 1}</span>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove step"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-graphite-400 hover:bg-red-500/10 hover:text-negative"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex gap-1.5">
              <div className="min-w-0 flex-1">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Amount"
                  value={h.fromAmount}
                  onChange={(e) => update(i, { fromAmount: e.target.value })}
                />
              </div>
              <div className="w-24 flex-none">
                <Select
                  value={h.fromCurrency}
                  onChange={(e) => update(i, { fromCurrency: e.target.value })}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex gap-1.5">
              <div className="min-w-0 flex-1">
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="Amount"
                  value={h.toAmount}
                  onChange={(e) => update(i, { toAmount: e.target.value })}
                />
              </div>
              <div className="w-24 flex-none">
                <Select
                  value={h.toCurrency}
                  onChange={(e) => update(i, { toCurrency: e.target.value })}
                >
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input type="date" value={h.date} onChange={(e) => update(i, { date: e.target.value })} />
            <Input
              placeholder="Notes (optional)"
              value={h.notes}
              onChange={(e) => update(i, { notes: e.target.value })}
            />
          </div>
          {Number(h.fromAmount) > 0 && Number(h.toAmount) > 0 && (
            <p className="mt-1 text-[10.5px] text-graphite-400">
              1 {h.fromCurrency} ={" "}
              {(Number(h.toAmount) / Number(h.fromAmount)).toLocaleString("en-US", {
                maximumFractionDigits: 9,
              })}{" "}
              {h.toCurrency}
            </p>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-graphite-600 hover:text-accent-text"
      >
        <Plus size={13} /> Add conversion step
      </button>

      {composite !== null && (
        <p className={`mt-2 text-[11px] ${endsInBase ? "text-graphite-600" : "text-warning"}`}>
          {endsInBase ? (
            <>
              Chain works out to 1 {hops[0].fromCurrency} ={" "}
              {composite.toLocaleString("en-US", { maximumFractionDigits: 9 })} {baseCode}.
              {onApplyRate && (
                <button
                  type="button"
                  onClick={() => onApplyRate(hops[0].fromCurrency, composite)}
                  className="ml-1.5 font-semibold text-accent-text underline underline-offset-2"
                >
                  Use as this record's rate
                </button>
              )}
            </>
          ) : (
            `Chain doesn't end in ${baseCode} yet — add a final step converting to ${baseCode} to use this as the record's rate.`
          )}
        </p>
      )}
    </div>
  );
}
