import { useEffect, useState } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { api } from "./api.ts";
import { Login } from "./pages/Login.tsx";
import { TrackEditor } from "./pages/TrackEditor.tsx";
import { TracksList } from "./pages/TracksList.tsx";

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void api
      .session()
      .then((r) => setAuthed(r.authed))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) return <div className="wrap muted">Loading…</div>;
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <BrowserRouter basename="/console">
      <div className="topbar">
        <Link to="/" className="brand" style={{ textDecoration: "none", color: "inherit" }}>
          Riddles Console
        </Link>
        <div className="spacer" />
        <button
          className="ghost"
          onClick={async () => {
            await api.logout();
            setAuthed(false);
          }}
        >
          Sign out
        </button>
      </div>
      <Routes>
        <Route path="/" element={<TracksList />} />
        <Route path="/tracks/:id" element={<TrackEditor />} />
        <Route path="*" element={<TracksList />} />
      </Routes>
    </BrowserRouter>
  );
}
