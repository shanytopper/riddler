import { API_URL } from "./client.ts";

export interface LeaderboardEntry {
  rank: number;
  teamName: string;
  score: number;
  playTimeMs: number;
  finishedAt: string;
}

export type LeaderboardWindow = "all" | "today";

/** Fetches a track's leaderboard from the API; null when there's no API or the request fails. */
export async function fetchLeaderboard(
  trackId: string,
  window: LeaderboardWindow = "all",
): Promise<LeaderboardEntry[] | null> {
  if (!API_URL) return null;
  try {
    const response = await fetch(
      `${API_URL}/tracks/${encodeURIComponent(trackId)}/leaderboard?window=${window}`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { entries?: LeaderboardEntry[] };
    return body.entries ?? [];
  } catch {
    return null;
  }
}
