import { useState } from "react";
import { api } from "../api.ts";

export function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.login(password);
      onLogin();
    } catch {
      setError("Wrong password.");
      setBusy(false);
    }
  };

  return (
    <div className="login card">
      <h1 className="center">Riddles Console</h1>
      <p className="muted center small">Sign in to edit and publish tracks.</p>
      <form onSubmit={submit} className="stack" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="pw">Password</label>
          <input
            id="pw"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error ? <div className="banner err">{error}</div> : null}
        <button className="primary" type="submit" disabled={busy || !password}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
