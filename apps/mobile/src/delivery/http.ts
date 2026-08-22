import type { Tenant } from "@riddles/bundle-schema";
import type { BundleRelease, DeliveryClient, TrackSummary, VenueSummary } from "./types.ts";

/**
 * The delivery client over the HTTP API (design.md §11.2). Same interface as the fixture client, so
 * the screens don't change; step 7 swaps this in when EXPO_PUBLIC_API_URL is set. A failed request
 * returns null/empty rather than throwing, so an offline venue screen degrades instead of crashing.
 */
export class HttpDeliveryClient implements DeliveryClient {
  private readonly base: string;

  constructor(baseUrl: string) {
    this.base = baseUrl.replace(/\/+$/, "");
  }

  async getTenant(slug: string): Promise<Tenant | null> {
    return this.getJson<Tenant>(`/v/${encodeURIComponent(slug)}`);
  }

  async listTracks(tenantId: string): Promise<TrackSummary[]> {
    return (
      (await this.getJson<TrackSummary[]>(`/tenants/${encodeURIComponent(tenantId)}/tracks`)) ?? []
    );
  }

  async getTrack(trackId: string): Promise<{ tenant: Tenant; track: TrackSummary } | null> {
    return this.getJson<{ tenant: Tenant; track: TrackSummary }>(
      `/tracks/${encodeURIComponent(trackId)}`,
    );
  }

  async getBundle(trackId: string): Promise<BundleRelease | null> {
    return this.getJson<BundleRelease>(`/tracks/${encodeURIComponent(trackId)}/bundle`);
  }

  async nearbyVenues(): Promise<VenueSummary[]> {
    return (await this.getJson<VenueSummary[]>("/venues")) ?? [];
  }

  private async getJson<T>(path: string): Promise<T | null> {
    try {
      const response = await fetch(`${this.base}${path}`);
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      return null;
    }
  }
}
