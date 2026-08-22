import type { StringKey } from "../i18n/strings.ts";

export interface EmergencyNumber {
  label: StringKey;
  number: string;
}

const BY_COUNTRY: Record<string, EmergencyNumber[]> = {
  IL: [
    { label: "ambulance", number: "101" },
    { label: "police", number: "100" },
  ],
};

const DEFAULT: EmergencyNumber[] = [{ label: "emergencyServices", number: "112" }];

/** Public emergency numbers for a venue's country (ISO 3166-1 alpha-2). */
export function emergencyNumbers(countryCode: string): EmergencyNumber[] {
  return BY_COUNTRY[countryCode.toUpperCase()] ?? DEFAULT;
}
