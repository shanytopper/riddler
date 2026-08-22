import { useCallback, useEffect, useState } from "react";
import { api, type LeaderboardRow } from "../api.ts";

const time = (ms: number): string => {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** The moderation view of a track's leaderboard: every entry, hidden ones included, with a toggle. */
export function Leaderboard({ trackId }: { trackId: string }) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    void api.leaderboard(trackId).then(setRows);
  }, [trackId]);

  useEffect(load, [load]);

  const toggle = async (row: LeaderboardRow) => {
    setBusy(row.sessionId);
    try {
      await api.setHidden(row.sessionId, !row.hidden);
      load();
    } finally {
      setBusy(null);
    }
  };

  if (!rows) return <p className="muted">Loading…</p>;
  if (rows.length === 0) return <p className="muted">No results yet.</p>;

  return (
    <table className="board">
      <thead>
        <tr>
          <th>Team</th>
          <th>Score</th>
          <th>Time</th>
          <th>Finished</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.sessionId} className={row.hidden ? "hidden" : ""}>
            <td>{row.teamName}</td>
            <td>{row.score}</td>
            <td>{time(row.playTimeMs)}</td>
            <td className="small muted">{new Date(row.finishedAt).toLocaleString()}</td>
            <td>
              <button
                className="small"
                disabled={busy === row.sessionId}
                onClick={() => toggle(row)}
              >
                {row.hidden ? "Unhide" : "Hide"}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
