import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Layers,
  Coins,
  ReceiptText,
  ListChecks,
  Banknote,
  TrendingUp,
  KeyRound,
  LogOut,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useTeam } from "../team";
import { ChangePasswordModal } from "./ChangePasswordModal";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

const NAV_ICONS: Record<string, ReactNode> = {
  "/admin": <LayoutDashboard size={19} />,
  "/admin/teams": <Layers size={19} />,
  "/admin/investors": <Users size={19} />,
  "/admin/gold": <Coins size={19} />,
  "/admin/expenses": <ReceiptText size={19} />,
  "/admin/categories": <ListChecks size={19} />,
  "/admin/currencies": <Banknote size={19} />,
  "/admin/reports": <TrendingUp size={19} />,
  "/portal": <LayoutDashboard size={19} />,
};

const goldSurface =
  "bg-[linear-gradient(145deg,var(--color-gold-hi),var(--color-gold-500)_60%,var(--color-gold-lo))]";

export function AppShell({ nav, children }: { nav: NavItem[]; children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { teams, activeTeamId, setActiveTeam } = useTeam();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const showTeamBar = user?.role === "ADMIN" && teams.length > 0;

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const initial = (user?.investor?.name ?? user?.username ?? "A").charAt(0).toUpperCase();

  return (
    <>
      <div className="wall" aria-hidden />
      <div className="grain" aria-hidden />
      <div className="mx-auto grid min-h-dvh w-full max-w-[1520px] grid-cols-[56px_minmax(0,1fr)] overflow-hidden border-graphite-100 bg-ink-950 sm:min-h-[calc(100vh-44px)] sm:grid-cols-[76px_minmax(0,1fr)] sm:rounded-[26px] sm:border sm:shadow-[var(--edge),0_44px_96px_-44px_rgba(0,0,0,.7)]">
      {/* ── icon rail ── */}
      <aside className="glass relative z-[3] flex flex-col items-center gap-1.5 border-r border-graphite-100 bg-ink-800 py-4 [box-shadow:inset_1px_0_0_var(--sheen)] sm:py-5">
        <div
          className={`mb-3 grid h-9 w-9 flex-none place-items-center rounded-[13px] font-serif text-[15px] font-bold text-chrome-950 shadow-[0_6px_18px_-6px_var(--color-glow)] sm:h-10 sm:w-10 sm:rounded-[14px] ${goldSurface}`}
        >
          Au
        </div>

        <nav aria-label="Main" className="flex flex-col items-center gap-1.5">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `group relative grid h-11 w-11 place-items-center rounded-full border border-transparent transition-[transform,background-color,color,box-shadow] duration-150 ease-out active:scale-90 ${
                  isActive
                    ? `${goldSurface} text-chrome-950 shadow-[0_6px_18px_-6px_var(--color-glow)]`
                    : "text-graphite-500 hover:bg-ink-900 hover:text-graphite-900"
                }`
              }
            >
              {NAV_ICONS[item.to] ?? <LayoutDashboard size={19} />}
              <span className="pointer-events-none absolute left-[52px] top-1/2 z-20 -translate-y-1/2 scale-95 whitespace-nowrap rounded-lg border border-graphite-200 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-graphite-900 opacity-0 transition-all [background:color-mix(in_srgb,var(--wall)_88%,transparent)] [backdrop-filter:blur(8px)] group-hover:scale-100 group-hover:opacity-100">
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-2">
          <div className="my-2.5 h-px w-6 bg-ink-600" />
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="group relative grid h-11 w-11 place-items-center rounded-full text-graphite-500 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 hover:bg-ink-900 hover:text-graphite-900"
          >
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            <span className="pointer-events-none absolute left-[52px] top-1/2 z-20 -translate-y-1/2 scale-95 whitespace-nowrap rounded-lg border border-graphite-200 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-graphite-900 opacity-0 transition-all [background:color-mix(in_srgb,var(--wall)_88%,transparent)] [backdrop-filter:blur(8px)] group-hover:scale-100 group-hover:opacity-100">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          </button>
          <button
            onClick={() => setPwOpen(true)}
            aria-label="Change password"
            className="group relative grid h-11 w-11 place-items-center rounded-full text-graphite-500 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 hover:bg-ink-900 hover:text-graphite-900"
          >
            <KeyRound size={18} />
            <span className="pointer-events-none absolute left-[52px] top-1/2 z-20 -translate-y-1/2 scale-95 whitespace-nowrap rounded-lg border border-graphite-200 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-graphite-900 opacity-0 transition-all [background:color-mix(in_srgb,var(--wall)_88%,transparent)] [backdrop-filter:blur(8px)] group-hover:scale-100 group-hover:opacity-100">
              Change password
            </span>
          </button>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            aria-label="Sign out"
            className="group relative grid h-11 w-11 place-items-center rounded-full text-graphite-500 transition-[transform,background-color,color] duration-150 ease-out active:scale-90 hover:bg-ink-900 hover:text-negative"
          >
            <LogOut size={18} />
            <span className="pointer-events-none absolute left-[52px] top-1/2 z-20 -translate-y-1/2 scale-95 whitespace-nowrap rounded-lg border border-graphite-200 px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-graphite-900 opacity-0 transition-all [background:color-mix(in_srgb,var(--wall)_88%,transparent)] [backdrop-filter:blur(8px)] group-hover:scale-100 group-hover:opacity-100">
              Sign out
            </span>
          </button>
          <div
            title={`${user?.username ?? ""} · ${user?.role === "ADMIN" ? "Administrator" : "Investor"}`}
            className="grid h-9 w-9 place-items-center rounded-full border border-ink-600 bg-ink-700 font-serif text-sm font-semibold text-gold-500 sm:h-[38px] sm:w-[38px]"
          >
            {initial}
          </div>
        </div>
      </aside>

      {/* ── board ── */}
      <div className="min-w-0">
        {showTeamBar && (
          <div className="flex items-center gap-2 bg-ink-800/60 px-4 py-2 sm:gap-2.5 sm:px-6">
            <Layers size={15} className="flex-none text-graphite-400" />
            <span className="hidden text-[11px] font-semibold uppercase tracking-[0.08em] text-graphite-400 sm:inline">
              Team
            </span>
            <select
              value={activeTeamId ?? ""}
              onChange={(e) => setActiveTeam(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-ink-600 bg-ink-900 px-2.5 py-1.5 text-[13px] font-medium text-graphite-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/30 sm:flex-none sm:min-w-[220px]"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="hidden text-[11px] text-graphite-400 sm:inline">
              every page below is scoped to this team
            </span>
          </div>
        )}
        <div key={location.pathname} className="board-in px-4 py-4 sm:px-6 sm:py-6">
          {children}
        </div>
      </div>
      </div>
      <ChangePasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3.5 gap-y-3">
      <div className="min-w-0">
        <h1 className="m-0 font-serif text-[22px] font-semibold -tracking-[0.02em] text-graphite-900 sm:text-[26px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-graphite-500">
            {subtitle}
          </p>
        )}
      </div>
      {action && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:gap-2.5">
          {action}
        </div>
      )}
    </div>
  );
}

/** small dot separator for meta lines */
export function Dot() {
  return <span className="inline-block h-[3px] w-[3px] rounded-full bg-graphite-400" />;
}
