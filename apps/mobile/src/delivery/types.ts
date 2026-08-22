import type { BundleManifest, Tenant, TrackContent } from "@riddles/bundle-schema";
import type { LocalizedString } from "../i18n/strings.ts";

/** The current published version of a track, as the app needs it to download the bundle. */
export interface BundleRelease {
  manifest: BundleManifest;
  zipUrl: string;
}

/** What the venue home needs to list a track, without downloading its bundle. */
export interface TrackSummary {
  trackId: string;
  slug: string;
  name: LocalizedString;
  description: LocalizedString;
  coverUrl: string | null;
  difficulty: TrackContent["difficulty"];
  minAge: number | null;
  estimate: TrackContent["estimate"];
  languages: string[];
  defaultLanguage: string;
  safetyNotes: LocalizedString;
}

export interface VenueSummary {
  tenantId: string;
  slug: string;
  displayName: LocalizedString;
  coverUrl: string | null;
}

/**
 * The read side of the delivery API (design.md §11.2) as the app sees it. The prototype implements
 * it over fixture files; step 7 replaces that with the HTTP client without touching the screens.
 */
export interface DeliveryClient {
  getTenant(slug: string): Promise<Tenant | null>;
  listTracks(tenantId: string): Promise<TrackSummary[]>;
  getTrack(trackId: string): Promise<{ tenant: Tenant; track: TrackSummary } | null>;
  nearbyVenues(): Promise<VenueSummary[]>;
  /** The manifest and archive URL of the track's published version; null when unreachable. */
  getBundle(trackId: string): Promise<BundleRelease | null>;
}
