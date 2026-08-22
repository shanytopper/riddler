import sharp from "sharp";

/** Images shown in stations are capped at this many pixels on the long edge (design.md §8). */
export const MAX_IMAGE_EDGE = 1600;
/** Custom map images keep more detail: floor plans are read zoomed in. */
export const MAX_MAP_IMAGE_EDGE = 4096;

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface PreparedImage {
  data: Buffer;
  width: number;
  height: number;
  mime: ImageMime;
  ext: "jpg" | "png" | "webp";
}

const FORMATS: Record<string, { mime: ImageMime; ext: PreparedImage["ext"] }> = {
  jpeg: { mime: "image/jpeg", ext: "jpg" },
  png: { mime: "image/png", ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
};

/**
 * Resizes an image to fit within `maxEdge` (never enlarging), honouring EXIF orientation, and keeps
 * its format when it is one the app renders; anything else becomes JPEG.
 */
export async function prepareImage(source: Buffer, maxEdge: number): Promise<PreparedImage> {
  const image = sharp(source).rotate();
  const metadata = await image.metadata();
  const format = FORMATS[metadata.format ?? ""] ?? null;
  let pipeline = image.resize({
    width: maxEdge,
    height: maxEdge,
    fit: "inside",
    withoutEnlargement: true,
  });
  if (!format) pipeline = pipeline.jpeg({ quality: 85 });
  else if (format.mime === "image/jpeg") pipeline = pipeline.jpeg({ quality: 85 });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const out = format ?? FORMATS.jpeg!;
  return { data, width: info.width, height: info.height, mime: out.mime, ext: out.ext };
}
