import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, getToken, setToken } from "./api";

export interface AuthUser {
  id: string;
  username: string;
  role: "ADMIN" | "INVESTOR";
  investor: { id: string; name: string; sharePercentage: number } | null;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const r = await api.post("/auth/login", { username, password });
    setToken(r.data.token);
    setUser(r.data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
    location.href = "/login";
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export function RequireRole({
  role,
  children,
}: {
  role: "ADMIN" | "INVESTOR";
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-stone-400">Loading…</div>
    );
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  if (user.role !== role)
    return <Navigate to={user.role === "ADMIN" ? "/admin" : "/portal"} replace />;
  return <>{children}</>;
}
