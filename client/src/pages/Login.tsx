import { FormEvent, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { apiError } from "../api";
import { Button, Field, Input, ErrorNote } from "../components/ui";

const goldSurface =
  "bg-[linear-gradient(145deg,var(--color-gold-hi),var(--color-gold-500)_60%,var(--color-gold-lo))]";

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
    <>
      <div className="wall" aria-hidden />
      <div className="grain" aria-hidden />

      <div className="relative flex min-h-dvh items-center justify-center px-4 py-10 sm:min-h-[calc(100vh-44px)]">
        <div
          className="w-full max-w-[380px]"
          style={{ animation: "panel-in 220ms cubic-bezier(0.16,1,0.3,1)" }}
        >
          <div className="mb-6 flex items-center gap-3">
            <div
              className={`grid h-11 w-11 flex-none place-items-center rounded-[14px] font-serif text-[17px] font-bold text-chrome-950 shadow-[0_6px_18px_-6px_var(--color-glow)] ${goldSurface}`}
            >
              Au
            </div>
            <div>
              <div className="font-serif text-lg font-semibold text-graphite-900">AU Hub</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-graphite-500">
                Gold Trading CRM
              </div>
            </div>
          </div>

          <div className="glass rounded-[20px] border border-graphite-200 bg-ink-800">
            <div className="relative z-[1] p-6 sm:p-7">
              <h1 className="m-0 font-serif text-xl font-semibold -tracking-[0.01em] text-graphite-900">
                Sign in
              </h1>
              <p className="mt-1 text-sm text-graphite-500">Admin or investor account.</p>

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
          </div>

          <p className="mt-4 text-center text-xs text-graphite-500">
            Investor credentials are issued by the administrator.
          </p>
        </div>
      </div>
    </>
  );
}
