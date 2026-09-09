import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { apiError } from "../api";
import { Button, Field, Input, ErrorNote } from "../components/ui";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.role === "ADMIN" ? "/admin" : "/portal"} replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate("/");
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-theme="dark"
      className="flex min-h-screen items-center justify-center bg-ink-950 px-4"
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-lg font-bold text-chrome-950">
            A
          </div>
          <div>
            <div className="font-serif text-lg font-semibold text-white">AU Hub</div>
            <div className="text-xs uppercase tracking-wide text-stone-500">Gold Trading CRM</div>
          </div>
        </div>

        <div className="rounded-2xl bg-ink-800 p-6 shadow-[0_6px_16px_-4px_rgba(0,0,0,0.45)]">
          <h1 className="font-serif text-base font-semibold text-white">Sign in</h1>
          <p className="mt-1 text-sm text-graphite-500">
            Admin or investor account.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <Field label="Username" required>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="admin"
              />
            </Field>
            <Field label="Password" required>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>
            {error && <ErrorNote>{error}</ErrorNote>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-stone-500">
          Investor credentials are issued by the administrator.
        </p>
      </div>
    </div>
  );
}
