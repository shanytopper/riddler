/* Generated from schemas/tenant.schema.json by scripts/generate-types.ts. Do not edit. */

export type Uuid = string;
export type LanguageCode = string;
export type HttpsUrlOrNull = HttpsUrl | null;
export type HttpsUrl = string;
export type HexColor = string;
/**
 * E.164 with optional spaces or dashes, e.g. +972-3-000-0000.
 */
export type PhoneOrNull = string | null;

/**
 * The operator's public presence as the app receives it from the delivery API when a venue is entered. Not part of a track bundle: it is fetched online and cached on the device. A dedicated build pins one tenant at build time.
 */
export interface Tenant {
  schemaVersion: 1;
  tenantId: Uuid;
  /**
   * The venue code visitors can type and the path segment in deep links (/v/<slug>).
   */
  slug: string;
  displayName: LocalizedString;
  about: LocalizedString;
  /**
   * ISO 3166-1 alpha-2. Selects the local emergency number.
   */
  countryCode: string;
  /**
   * @minItems 1
   */
  languages: [LanguageCode, ...LanguageCode[]];
  defaultLanguage: LanguageCode;
  websiteUrl?: HttpsUrlOrNull;
  theme: {
    primary: HexColor;
    /**
     * Text and icons drawn on `primary`. The console enforces a contrast ratio of at least 4.5:1.
     */
    onPrimary: string;
    accent: HexColor;
    onAccent: HexColor;
    background: "light" | "dark";
    /**
     * Pairings that cover Hebrew and Latin. Bundled with the app, not downloaded.
     */
    typography: "heebo" | "assistant" | "rubik" | "system";
    logoUrl: HttpsUrlOrNull;
    logoDarkUrl: HttpsUrlOrNull;
    coverUrl: HttpsUrlOrNull;
  };
  contacts: {
    support: {
      phone?: PhoneOrNull;
      email?: string | null;
      url?: HttpsUrlOrNull;
    };
    emergency: {
      /**
       * E.164 with optional spaces or dashes, e.g. +972-3-000-0000.
       */
      phone: string | null;
      note?: LocalizedString;
    };
  };
  legal: {
    privacyUrl: HttpsUrl;
    termsUrl: HttpsUrl;
  };
}
export interface LocalizedString {
  [k: string]: string | undefined;
}
