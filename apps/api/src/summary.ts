import type { TrackContent } from "@riddles/bundle-schema";

/**
 * The track summary the venue home needs without downloading the bundle. Its shape matches the
 * mobile app's `TrackSummary`; the HTTP delivery client deserializes this directly. Localized-string
 * fields borrow their type from the content so we don't depend on an unexported alias.
 */
export interface TrackSummary {
  trackId: string;
  slug: string;
  name: TrackContent["name"];
  description: TrackContent["description"];
  coverUrl: string | null;
  difficulty: TrackContent["difficulty"];
  minAge: number | null;
  estimate: TrackContent["estimate"];
  languages: string[];
  defaultLanguage: string;
  safetyNotes: TrackContent["safetyNotes"];
}

export function summarize(content: TrackContent): TrackSummary {
  const cover = content.coverMediaId
    ? (content.media.find((m) => m.id === content.coverMediaId) ?? null)
    : null;
  return {
    trackId: content.trackId,
    slug: content.slug,
    name: content.name,
    description: content.description,
    coverUrl: cover ? cover.path : null,
    difficulty: content.difficulty,
    minAge: content.minAge ?? null,
    estimate: content.estimate,
    languages: [...content.languages],
    defaultLanguage: content.defaultLanguage,
    safetyNotes: content.safetyNotes,
  };
}
