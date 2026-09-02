export type {
  Arrival,
  Challenge,
  ChallengeChoice,
  ChallengeMultiChoice,
  ChallengeNumber,
  ChallengeText,
  ChoiceOption,
  ContentBlock,
  Hint,
  ImagePosition,
  Leg,
  Location,
  MapImage,
  MapTiles,
  Media,
  Reveal,
  Rules,
  Station,
  TrackContent,
  Waypoint,
} from "./generated/content.ts";
export type { BundleManifest, ImageArtifact, TilesArtifact } from "./generated/manifest.ts";
export type { Tenant } from "./generated/tenant.ts";

export { SCHEMA_KINDS, loadSchema, schemaIssues, validatorFor } from "./schema.ts";
export type { Issue, SchemaKind } from "./schema.ts";
export {
  BUNDLE_MAX_BYTES,
  BUNDLE_WARN_BYTES,
  contentInvariants,
  tenantInvariants,
  visitLocalized,
} from "./invariants.ts";
export type { ContentContext, InvariantReport } from "./invariants.ts";
export { MIN_TEXT_CONTRAST, contrastRatio, relativeLuminance } from "./contrast.ts";
export {
  hasErrors,
  kindFromFilename,
  validateDocument,
  validateFile,
  validateTree,
} from "./validate.ts";
export type { DocumentReport, FileReport, TreeReport } from "./validate.ts";
