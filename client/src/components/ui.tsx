import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useEffect,
} from "react";
import { X } from "lucide-react";

/* ---------- Button ---------- */
type Variant = "primary" | "secondary" | "ghost" | "danger";
const btnStyles: Record<Variant, string> = {
  primary:
    "bg-gold-500 text-chrome-950 font-semibold hover:bg-gold-400 disabled:opacity-50",
  secondary:
    "bg-ink-800 text-graphite-700 border border-ink-600 hover:bg-ink-700 disabled:opacity-50",
  ghost: "text-graphite-500 hover:bg-ink-800 hover:text-graphite-700 disabled:opacity-50",
  danger: "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50",
};
export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-[transform,background-color,color,border-color] duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-gold-400/40 active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100 ${btnStyles[variant]} ${className}`}
      {...props}
    />
  );
}

/* ---------- Card ---------- */
export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className={`glass rounded-[20px] border border-graphite-200 bg-ink-800 ${className}`}
    >
      <div className="relative z-[1]">
        {(title || action) && (
          <div className="flex items-center justify-between border-b border-graphite-100 px-5 py-3.5">
            <h3 className="font-serif text-sm font-semibold tracking-wide text-graphite-800">
              {title}
            </h3>
            {action}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------- Stat ----------
 * Figures use the body sans at proportional width — not the mono/tabular face.
 * tabular-nums is reserved for columns that align vertically (tables, axis
 * ticks); a lone stat value looks loose in tabular figures. Pass `emphasis`
 * for the one metric a view leads with (hero treatment). Pass `dense` for a
 * secondary row of lower-priority figures. */
export function Stat({
  label,
  value,
  sub,
  tone = "default",
  emphasis = false,
  dense = false,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "positive" | "negative" | "gold";
  emphasis?: boolean;
  dense?: boolean;
}) {
  const toneMap = {
    default: "text-graphite-900",
    positive: "text-positive",
    negative: "text-negative",
    gold: "text-accent-text",
  };
  const valueSize = emphasis ? "text-3xl" : dense ? "text-lg" : "text-xl";
  return (
    <div
      className={`glass rounded-[18px] border bg-ink-800 ${
        dense ? "p-3.5" : "p-4"
      } ${emphasis ? "border-gold-500/40" : "border-graphite-200"}`}
    >
      <div className="relative z-[1]">
        <div className="text-xs font-medium uppercase tracking-wide text-graphite-500">
          {label}
        </div>
        <div className={`mt-1.5 font-semibold ${valueSize} ${toneMap[tone]}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-graphite-500">{sub}</div>}
      </div>
    </div>
  );
}

/* ---------- GaugeRing ---------- */
/** Circular percentage gauge — the "gold allocation" donut look from the
 * reference dashboards. Pure SVG, no chart library. */
export function GaugeRing({
  value,
  size = 108,
  strokeWidth = 9,
  label,
  valueLabel,
  color = "var(--color-gold-500)",
  trackColor = "var(--color-ink-700)",
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  valueLabel?: string;
  color?: string;
  trackColor?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / 100) * c;
  const valueCls =
    size >= 140 ? "text-2xl" : size >= 100 ? "text-lg" : size >= 64 ? "text-sm" : "text-xs";
  const showLabel = label && size >= 64;
  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <div className={`font-semibold leading-none text-graphite-900 ${valueCls}`}>
          {valueLabel ?? `${clamped.toFixed(1)}%`}
        </div>
        {showLabel && (
          <div className="mt-1.5 text-[9px] font-medium uppercase leading-tight tracking-wide text-graphite-500">
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Badge ---------- */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "red" | "amber" | "gold";
}) {
  const map = {
    neutral: "bg-graphite-100 text-graphite-600",
    green: "bg-emerald-500/15 text-positive",
    red: "bg-red-500/15 text-negative",
    amber: "bg-amber-500/15 text-warning",
    gold: "bg-gold-500/15 text-accent-text",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${map[tone]}`}
    >
      {children}
    </span>
  );
}

/* ---------- Form fields ---------- */
export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-graphite-500">
        {label} {required && <span className="text-negative">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-graphite-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-graphite-900 placeholder:text-graphite-400 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} className={`${inputCls} min-h-[72px] ${props.className ?? ""}`} />
  );
}

/* ---------- Modal ---------- */
export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:p-8"
      style={{ animation: "overlay-in 120ms ease-out" }}
    >
      <div
        className={`glass w-full ${wide ? "max-w-2xl" : "max-w-lg"} rounded-[20px] border border-graphite-200`}
        style={{
          animation: "panel-in 150ms cubic-bezier(0.16,1,0.3,1)",
          background: "color-mix(in srgb, var(--wall) 84%, transparent)",
        }}
      >
        <div className="relative z-[1] flex items-center justify-between border-b border-graphite-100 px-5 py-3.5">
          <h3 className="font-serif text-sm font-semibold text-graphite-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-graphite-400 transition-colors hover:bg-graphite-100 hover:text-graphite-700"
          >
            <X size={18} />
          </button>
        </div>
        <div className="relative z-[1] p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- misc ---------- */
export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-sm text-graphite-400">
      Loading…
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-sm font-medium text-graphite-500">{title}</p>
      {hint && <p className="mt-1 text-xs text-graphite-400">{hint}</p>}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-negative">{children}</div>
  );
}
