import { Navigate, Route, Routes } from "react-router-dom";
import { RequireRole, useAuth } from "./auth";
import { AppShell, type NavItem } from "./components/AppShell";
import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import Investors from "./pages/admin/Investors";
import Gold from "./pages/admin/Gold";
import Expenses from "./pages/admin/Expenses";
import Categories from "./pages/admin/Categories";
import Reports from "./pages/admin/Reports";
import PortalDashboard from "./pages/portal/PortalDashboard";

const adminNav: NavItem[] = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/investors", label: "Investors" },
  { to: "/admin/gold", label: "Gold Trades" },
  { to: "/admin/expenses", label: "Expenses" },
  { to: "/admin/categories", label: "Expense Headers" },
  { to: "/admin/reports", label: "Profit & Loss" },
];

const portalNav: NavItem[] = [{ to: "/portal", label: "My Account", end: true }];

function AdminArea() {
  return (
    <RequireRole role="ADMIN">
      <AppShell nav={adminNav}>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="investors" element={<Investors />} />
          <Route path="gold" element={<Gold />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="categories" element={<Categories />} />
          <Route path="reports" element={<Reports />} />
          <Route path="view/:investorId" element={<PortalDashboard />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AppShell>
    </RequireRole>
  );
}

function PortalArea() {
  return (
    <RequireRole role="INVESTOR">
      <AppShell nav={portalNav}>
        <Routes>
          <Route index element={<PortalDashboard />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Routes>
      </AppShell>
    </RequireRole>
  );
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "ADMIN" ? "/admin" : "/portal"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/*" element={<AdminArea />} />
      <Route path="/portal/*" element={<PortalArea />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
