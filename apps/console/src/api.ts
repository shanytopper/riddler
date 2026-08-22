import type { TrackContent } from "@riddles/bundle-schema";

/** Typed calls to the console API (same origin, cookie-authenticated). */

export interface Issue {
  path: string;
  message: string;
}
export interface ValidationReport {
  ok: boolean;
  errors: Issue[];
  warnings: Issue[];
}
export interface EditorTrack {
  trackId: string;
  slug: string;
  publishedVersion: number | null;
  hasDraft: boolean;
  name: Record<string, string | undefined>;
}
export interface LeaderboardRow {
  sessionId: string;
  teamName: string;
  score: number;
  playTimeMs: number;
  hidden: boolean;
  finishedAt: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    credentials: "same-origin",
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      message = ((await response.json()) as { error?: string }).error ?? message;
    } catch {
      // non-JSON error
    }
    throw new ApiError(response.status, message);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const api = {
  isApiError: (error: unknown): error is ApiError => error instanceof ApiError,
  session: () => call<{ authed: boolean }>("/console-api/session"),
  login: (password: string) =>
    call<{ ok: true }>("/console-api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: () => call<{ ok: true }>("/console-api/logout", { method: "POST" }),
  tracks: () => call<{ tracks: EditorTrack[] }>("/console-api/tracks").then((r) => r.tracks),
  createTrack: (name: string) =>
    call<{ trackId: string; slug: string }>("/console-api/tracks", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  track: (id: string) =>
    call<{ content: TrackContent }>(`/console-api/tracks/${encodeURIComponent(id)}`).then(
      (r) => r.content,
    ),
  saveDraft: (id: string, content: TrackContent) =>
    call<{ ok: true }>(`/console-api/tracks/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  validate: (id: string) =>
    call<ValidationReport>(`/console-api/tracks/${encodeURIComponent(id)}/validate`, {
      method: "POST",
    }),
  publish: (id: string) =>
    call<{ version: number; warnings: Issue[] }>(
      `/console-api/tracks/${encodeURIComponent(id)}/publish`,
      { method: "POST" },
    ),
  leaderboard: (id: string) =>
    call<{ entries: LeaderboardRow[] }>(
      `/console-api/tracks/${encodeURIComponent(id)}/leaderboard`,
    ).then((r) => r.entries),
  setHidden: (sessionId: string, hidden: boolean) =>
    call<{ ok: true }>(`/console-api/leaderboard/${encodeURIComponent(sessionId)}/hide`, {
      method: "POST",
      body: JSON.stringify({ hidden }),
    }),
};
