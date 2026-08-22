export const TEAM_NAME_MIN = 2;
export const TEAM_NAME_MAX = 24;

/**
 * A light filter, since team names can appear on a public leaderboard (design.md §10). Shared by
 * the app (to refuse a name at entry) and the API (to hide an entry whose name slipped past a
 * client), so the server never trusts the client's filtering.
 */
const BLOCKED = ["fuck", "shit", "nazi", "זונה", "מניאק"];

export type TeamNameVerdict = "ok" | "length" | "blocked";

export function validateTeamName(name: string): TeamNameVerdict {
  const trimmed = name.trim();
  const length = Array.from(trimmed).length;
  if (length < TEAM_NAME_MIN || length > TEAM_NAME_MAX) return "length";
  const lower = trimmed.toLowerCase();
  return BLOCKED.some((word) => lower.includes(word)) ? "blocked" : "ok";
}
