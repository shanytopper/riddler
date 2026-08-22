import type { BundleManifest, Tenant, TrackContent } from "@riddles/bundle-schema";
import einDrorTenant from "../../../../content/ein-dror/tenant.json";
import springTrail from "../../../../content/ein-dror/tracks/spring-trail/content.json";
import type { BundleRelease, DeliveryClient, TrackSummary, VenueSummary } from "./types.ts";

/** Where `npm run bundle` output is served during the prototype, e.g. http://10.0.2.2:8081/bundles */
const BUNDLES_BASE_URL = process.env.EXPO_PUBLIC_BUNDLES_URL ?? null;
/** The prototype publishes one version of each track. */
const PUBLISHED_VERSION = 1;

interface FixtureVenue {
  tenant: Tenant;
  tracks: TrackContent[];
}

// The repository's content/ folder stands in for the delivery API until step 7. The same files are
// validated by @riddles/bundle-schema's tests, so what the app shows is always publishable content.
const VENUES: FixtureVenue[] = [
  {
    tenant: einDrorTenant as unknown as Tenant,
    tracks: [springTrail as unknown as TrackContent],
  },
];

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

export class FixtureDeliveryClient implements DeliveryClient {
  async getTenant(slug: string): Promise<Tenant | null> {
    return VENUES.find((venue) => venue.tenant.slug === slug)?.tenant ?? null;
  }

  async listTracks(tenantId: string): Promise<TrackSummary[]> {
    const venue = VENUES.find((candidate) => candidate.tenant.tenantId === tenantId);
    return venue ? venue.tracks.map(summarize) : [];
  }

  async getTrack(trackId: string): Promise<{ tenant: Tenant; track: TrackSummary } | null> {
    for (const venue of VENUES) {
      const content = venue.tracks.find((track) => track.trackId === trackId);
      if (content) return { tenant: venue.tenant, track: summarize(content) };
    }
    return null;
  }

  async getBundle(trackId: string): Promise<BundleRelease | null> {
    if (!BUNDLES_BASE_URL) return null;
    const base = `${BUNDLES_BASE_URL.replace(/\/+$/, "")}/${trackId}-v${PUBLISHED_VERSION}`;
    try {
      const response = await fetch(`${base}.manifest.json`);
      if (!response.ok) return null;
      const manifest = (await response.json()) as BundleManifest;
      return { manifest, zipUrl: `${base}.zip` };
    } catch {
      return null;
    }
  }

  async nearbyVenues(): Promise<VenueSummary[]> {
    return VENUES.map(({ tenant }) => ({
      tenantId: tenant.tenantId,
      slug: tenant.slug,
      displayName: tenant.displayName,
      coverUrl: tenant.theme.coverUrl,
    }));
  }
}
