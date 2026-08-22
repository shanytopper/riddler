/* Generated from schemas/manifest.schema.json by scripts/generate-types.ts. Do not edit. */

export type Uuid = string;
export type ContentFile = File & {
  path?: "content.json";
};
export type MediaArtifact = File & {
  id: Uuid;
  mime: "image/jpeg" | "image/png" | "image/webp";
  widthPx: number;
  heightPx: number;
};
export type TilesArtifact = File & {
  legId: Uuid;
  kind: "pmtiles";
  delivery: "bundled" | "deferred";
  /**
   * @minItems 4
   * @maxItems 4
   */
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
};
export type ImageArtifact = File & {
  legId: Uuid;
  kind: "image";
  delivery: "bundled" | "deferred";
  mime: "image/jpeg" | "image/png" | "image/webp";
  widthPx: number;
  heightPx: number;
};

/**
 * Written by the bundle builder, never authored. Served by the delivery API so the app can show the download size before fetching, and included in the archive so the app can verify what it received.
 */
export interface BundleManifest {
  /**
   * Schema version of both this manifest and the content.json it describes. The app refuses bundles newer than it understands and supports the previous version.
   */
  schemaVersion: 1;
  bundleId: Uuid;
  tenantId: Uuid;
  trackId: Uuid;
  trackVersion: number;
  publishedAt: string;
  /**
   * @minItems 1
   */
  languages: [string, ...string[]];
  files: {
    content: ContentFile;
    media: MediaArtifact[];
    /**
     * One entry per leg. Artifacts marked deferred are not in the archive and are fetched separately, typically the maps of later legs.
     */
    maps: (TilesArtifact | ImageArtifact)[];
    /**
     * Basemap glyph ranges (fonts/<stack>/<range>.pbf) for the track's languages. Absent when no leg uses a tiles map.
     */
    fonts?: AssetFile[];
    /**
     * Basemap sprite sheets and indexes (sprites/<flavor>.*) for both UI schemes.
     */
    sprites?: AssetFile[];
  };
  /**
   * Size of the archive as downloaded, i.e. bundled artifacts only.
   */
  totalBytes: number;
}
export interface File {
  path: string;
  bytes: number;
  sha256: string;
}
export interface AssetFile {
  path: string;
  bytes: number;
  sha256: string;
}
