import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { BundleManifest, TrackContent } from "@riddles/bundle-schema";
import { validateDocument } from "@riddles/bundle-schema";
import { unzipSync } from "fflate";
import sharp from "sharp";
import { buildBundle } from "./build.ts";
import { prepareImage } from "./media.ts";

const springTrail = fileURLToPath(
  new URL("../../../content/ein-dror/tracks/spring-trail/content.json", import.meta.url),
);
const TENANT = "7c1f0d2e-5a3b-4c8d-9e1f-2a3b4c5d6e7f";

const sha256 = (data: Uint8Array): string => createHash("sha256").update(data).digest("hex");

test("images are resized to the long-edge cap and keep a renderable format", async () => {
  const png = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: "#1f5e3b" },
  })
    .png()
    .toBuffer();
  const image = await prepareImage(png, 1600);
  assert.equal(image.width, 1600);
  assert.equal(image.height, 1067);
  assert.equal(image.mime, "image/png");
  const small = await sharp({
    create: { width: 300, height: 200, channels: 3, background: "#fff" },
  })
    .jpeg()
    .toBuffer();
  const kept = await prepareImage(small, 1600);
  assert.equal(kept.width, 300);
  assert.equal(kept.ext, "jpg");
});

test(
  "the Spring Trail builds into an archive whose manifest hashes match its contents",
  { skip: !existsSync(springTrail) },
  async () => {
    const out = mkdtempSync(join(tmpdir(), "riddles-bundle-"));
    const result = await buildBundle({
      contentPath: springTrail,
      outDir: out,
      tenantId: TENANT,
      trackVersion: 3,
      skipMapData: true,
      publishedAt: "2026-09-01T08:00:00Z",
      writeTokensBack: false,
    });

    assert.ok(result.zipPath.endsWith("3f9a2b1c-8d7e-4f60-a1b2-c3d4e5f60718-v3.zip"));
    const files = unzipSync(readFileSync(result.zipPath));
    assert.deepEqual(Object.keys(files).sort(), ["content.json", "manifest.json"]);

    const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"])) as BundleManifest;
    assert.deepEqual(validateDocument("manifest", manifest).schema, []);
    assert.equal(manifest.trackVersion, 3);
    assert.equal(manifest.tenantId, TENANT);
    assert.equal(manifest.files.content.sha256, sha256(files["content.json"]!));
    assert.equal(manifest.files.content.bytes, files["content.json"]!.byteLength);
    assert.equal(
      manifest.totalBytes,
      files["content.json"]!.byteLength + files["manifest.json"]!.byteLength,
    );

    const content = JSON.parse(new TextDecoder().decode(files["content.json"])) as TrackContent;
    assert.equal(content.authoringNotes, undefined, "authoring notes must not ship");
    assert.deepEqual(validateDocument("content", content).schema, []);
    assert.equal(
      readFileSync(result.manifestPath, "utf8"),
      new TextDecoder().decode(files["manifest.json"]),
    );
  },
);

test("media are renamed to their ids, resized, listed in the manifest, and qr tokens are generated", async () => {
  const dir = mkdtempSync(join(tmpdir(), "riddles-authored-"));
  mkdirSync(join(dir, "media"));
  writeFileSync(
    join(dir, "media", "oak.png"),
    await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#888" } })
      .png()
      .toBuffer(),
  );
  const authored = JSON.parse(readFileSync(springTrail, "utf8")) as TrackContent;
  const mediaId = "aaaa1111-2222-4333-8444-555566667777";
  authored.media = [
    { id: mediaId, kind: "image", path: "media/oak.png", alt: { he: "אלון", en: "Oak" } },
  ];
  authored.coverMediaId = mediaId;
  authored.legs[0].stations[0].arrival = { methods: ["qr"], automatic: false, radiusMeters: 30 };
  const contentPath = join(dir, "content.json");
  writeFileSync(contentPath, JSON.stringify(authored));

  const out = mkdtempSync(join(tmpdir(), "riddles-bundle-"));
  const result = await buildBundle({
    contentPath,
    outDir: out,
    tenantId: TENANT,
    trackVersion: 1,
    skipMapData: true,
  });
  const files = unzipSync(readFileSync(result.zipPath));
  assert.ok(files[`media/${mediaId}.png`], "media stored under its id");
  const media = result.manifest.files.media[0]!;
  assert.equal(media.widthPx, 1600);
  assert.equal(media.heightPx, 800);
  assert.equal(media.mime, "image/png");
  assert.equal(media.sha256, sha256(files[`media/${mediaId}.png`]!));

  const shipped = JSON.parse(new TextDecoder().decode(files["content.json"])) as TrackContent;
  assert.equal(shipped.media[0]!.path, `media/${mediaId}.png`);
  const token = shipped.legs[0].stations[0].arrival.qrToken;
  assert.match(token ?? "", /^[A-Za-z0-9_-]{8,32}$/);
  const rewritten = JSON.parse(readFileSync(contentPath, "utf8")) as TrackContent;
  assert.equal(
    rewritten.legs[0].stations[0].arrival.qrToken,
    token,
    "the token is written back so printed codes stay valid",
  );
  assert.equal(rewritten.media[0]!.path, "media/oak.png", "the authored media path is untouched");
});

test("unpublishable content is refused with the validator's findings", async () => {
  const dir = mkdtempSync(join(tmpdir(), "riddles-bad-"));
  const authored = JSON.parse(readFileSync(springTrail, "utf8")) as TrackContent;
  authored.legs[0].stations[1]!.title = { he: "רק עברית" };
  writeFileSync(join(dir, "content.json"), JSON.stringify(authored));
  await assert.rejects(
    buildBundle({
      contentPath: join(dir, "content.json"),
      outDir: dir,
      tenantId: TENANT,
      trackVersion: 1,
      skipMapData: true,
    }),
    /not publishable[\s\S]*missing language: en/,
  );
});
