import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, apiError } from "../api";
import { useAuth } from "../auth";
import { Modal, Field, Input, Button, ErrorNote } from "./ui";

const MIN_LEN = 12;

export function ChangePasswordModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  function close() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError("");
    setBusy(false);
    setDone(false);
    onClose();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next.length < MIN_LEN)
      return setError(`New password must be at least ${MIN_LEN} characters.`);
    if (next !== confirm) return setError("New password and confirmation do not match.");
    if (next === current)
      return setError("New password must be different from the current one.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: current,
        newPassword: next,
      });
      setDone(true);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Change password">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm text-graphite-700">
            Your password has been changed. Sign in again with the new one.
          </p>
          <Button
            className="w-full"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign in again
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Current password" required>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoFocus
            />
          </Field>
          <Field
            label="New password"
            required
            hint={`At least ${MIN_LEN} characters. A password-manager-generated string is best.`}
          >
            <Input
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </Field>
          <Field label="Confirm new password" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Change password"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
