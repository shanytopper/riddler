/**
 * Parsing of everything that can bring a visitor into a venue or track: the universal links from
 * design.md §9.2, the custom scheme, a scanned QR payload, or a venue code typed by hand.
 */
export type ParsedLink =
  | { kind: "venue"; slug: string }
  | { kind: "track"; trackId: string }
  | { kind: "station"; trackId: string; stationId: string; token: string | null };

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Tidies a typed venue code; returns null when it cannot be a code. */
export function normalizeVenueCode(input: string): string | null {
  const code = input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  return SLUG.test(code) ? code : null;
}

export function parseLink(raw: string): ParsedLink | null {
  const text = raw.trim();
  if (!text) return null;

  const { segments, query } = pathOf(text);
  if (segments.length === 0) return null;

  const [head, a, b] = segments;
  if (head === "v" && a && segments.length === 2) {
    const slug = normalizeVenueCode(a);
    return slug ? { kind: "venue", slug } : null;
  }
  if (head === "t" && a && segments.length === 2 && UUID.test(a)) {
    return { kind: "track", trackId: a.toLowerCase() };
  }
  if (head === "s" && a && b && segments.length === 3 && UUID.test(a) && UUID.test(b)) {
    return {
      kind: "station",
      trackId: a.toLowerCase(),
      stationId: b.toLowerCase(),
      token: query.get("k"),
    };
  }
  if (segments.length === 1 && !text.includes("/") && !text.includes(":")) {
    const slug = normalizeVenueCode(head ?? "");
    return slug ? { kind: "venue", slug } : null;
  }
  return null;
}

function pathOf(text: string): { segments: string[]; query: URLSearchParams } {
  let path = text;
  let query = new URLSearchParams();
  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) {
    try {
      const url = new URL(text);
      query = url.searchParams;
      const isWeb = url.protocol === "http:" || url.protocol === "https:";
      // riddles://v/ein-dror parses with host "v"; fold the host back into the path.
      path = isWeb ? url.pathname : `${url.host}${url.pathname}`;
    } catch {
      return { segments: [], query };
    }
  } else {
    const queryStart = text.indexOf("?");
    if (queryStart >= 0) {
      query = new URLSearchParams(text.slice(queryStart + 1));
      path = text.slice(0, queryStart);
    }
  }
  const segments = path
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .filter((segment) => segment.length > 0);
  return { segments, query };
}
