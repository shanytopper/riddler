import assert from "node:assert/strict";
import { test } from "node:test";
import { contentInvariants, tenantInvariants } from "./invariants.ts";
import { schemaIssues } from "./schema.ts";
import { L, MEDIA_A, STATION_A, minimalContent, minimalTenant, station } from "./test-fixtures.ts";

const paths = (issues: { path: string }[]): string[] => issues.map((issue) => issue.path);

test("the minimal content has no errors or warnings", () => {
  assert.deepEqual(contentInvariants(minimalContent()), { errors: [], warnings: [] });
});

test("1. every localized string needs every track language", () => {
  const content = minimalContent();
  content.legs[0].stations[1]!.title = { he: "רק עברית" };
  delete content.legs[0].stations[1]!.reveal.clue!.text.en;
  const { errors } = contentInvariants(content);
  assert.deepEqual(paths(errors), [
    "/legs/0/stations/1/title",
    "/legs/0/stations/1/reveal/clue/text",
  ]);
  assert.match(errors[0]!.message, /missing language: en/);
});

test("1. accepted answers are checked per language", () => {
  const content = minimalContent();
  const challenge = content.legs[0].stations[0].challenge;
  assert.ok(challenge?.type === "text");
  challenge.accepted = { he: ["כן"] };
  assert.deepEqual(paths(contentInvariants(content).errors), [
    "/legs/0/stations/0/challenge/accepted",
  ]);
});

test("1. defaultLanguage must be one of languages", () => {
  const content = minimalContent();
  content.defaultLanguage = "ar";
  assert.deepEqual(paths(contentInvariants(content).errors), ["/defaultLanguage"]);
});

test("2. station ids are unique across the track", () => {
  const content = minimalContent();
  content.legs[0].stations[1]!.id = STATION_A;
  const { errors } = contentInvariants(content);
  assert.deepEqual(paths(errors), ["/legs/0/stations/1/id"]);
  assert.match(errors[0]!.message, /also used at \/legs\/0\/stations\/0/);
});

test("2. correct options must exist and option ids be unique", () => {
  const content = minimalContent();
  const challenge = content.legs[0].stations[1]!.challenge;
  assert.ok(challenge?.type === "choice");
  challenge.correctOptionId = "z";
  challenge.options[1].id = "a";
  const { errors } = contentInvariants(content);
  assert.deepEqual(paths(errors), [
    "/legs/0/stations/1/challenge/options",
    "/legs/0/stations/1/challenge",
  ]);
});

test("3. media references must resolve, files must exist, visitor-facing images need alt", () => {
  const content = minimalContent();
  content.media = [{ id: MEDIA_A, kind: "image", path: "media/oak.jpg" }];
  content.coverMediaId = MEDIA_A;
  content.legs[0].stations[0].intro = [
    { type: "image", mediaId: "bbbb1111-2222-4333-8444-555566667777" },
  ];
  const { errors } = contentInvariants(content, { mediaBytes: () => undefined });
  assert.deepEqual(paths(errors), [
    "/media/0/path",
    "/media/0",
    "/legs/0/stations/0/intro/0/mediaId",
  ]);
  assert.match(errors[0]!.message, /file not found/);
  assert.match(errors[1]!.message, /needs alt text/);
  assert.match(errors[2]!.message, /unknown media id/);
});

test("3. map images are not required to have alt text", () => {
  const content = minimalContent();
  content.media = [{ id: MEDIA_A, kind: "image", path: "media/plan.png" }];
  content.legs[0].map = { kind: "image", mediaId: MEDIA_A, widthPx: 2000, heightPx: 1500 };
  content.legs[0].stations.forEach((s) => (s.imagePosition = { x: 0.5, y: 0.5 }));
  assert.deepEqual(contentInvariants(content, { mediaBytes: () => 1024 }).errors, []);
});

test("4. stations on a tiles map need a location inside the bounds", () => {
  const content = minimalContent();
  content.legs[0].stations[0].location = { lat: 31.0, lng: 34.81 };
  delete content.legs[0].stations[1]!.location;
  const { errors } = contentInvariants(content);
  assert.deepEqual(paths(errors), [
    "/legs/0/stations/0/location",
    "/legs/0/stations/1/location",
    "/legs/0/stations/1/location",
  ]);
  assert.match(errors[0]!.message, /outside/);
  assert.match(errors[2]!.message, /distance feedback/);
});

test("4. stations on an image map need an image position", () => {
  const content = minimalContent();
  content.media = [{ id: MEDIA_A, kind: "image", path: "media/plan.png" }];
  content.legs[0].map = { kind: "image", mediaId: MEDIA_A, widthPx: 2000, heightPx: 1500 };
  content.legs[0].stations[0].imagePosition = { x: 0.1, y: 0.1 };
  assert.deepEqual(paths(contentInvariants(content).errors), ["/legs/0/stations/1/imagePosition"]);
});

test("5. gps arrival needs a location", () => {
  const content = minimalContent();
  content.legs[0].map = { kind: "image", mediaId: MEDIA_A, widthPx: 10, heightPx: 10 };
  content.media = [{ id: MEDIA_A, kind: "image", path: "media/plan.png" }];
  content.legs[0].stations.forEach((s) => {
    s.imagePosition = { x: 0.5, y: 0.5 };
    delete s.location;
  });
  content.legs[0].stations[0].arrival.methods = ["gps"];
  content.legs[0].stations[1]!.reveal.distanceFeedback = false;
  const { errors } = contentInvariants(content);
  assert.deepEqual(paths(errors), ["/legs/0/stations/0/location"]);
  assert.match(errors[0]!.message, /gps arrival/);
});

test("6. info stations carry no points and no hints", () => {
  const content = minimalContent();
  content.legs[0].stations[1] = station({
    id: content.legs[0].stations[1]!.id,
    challenge: null,
    points: 50,
    hints: [{ text: L("רמז", "Hint"), cost: 10 }],
  });
  assert.deepEqual(paths(contentInvariants(content).errors), [
    "/legs/0/stations/1/points",
    "/legs/0/stations/1/hints",
  ]);
});

test("7. time bonus cutoff must exceed par", () => {
  const content = minimalContent();
  content.rules.timeBonus = { points: 100, parSeconds: 600, cutoffSeconds: 600 };
  assert.deepEqual(paths(contentInvariants(content).errors), ["/rules/timeBonus"]);
});

test("8. bounds and zoom range must be well-formed", () => {
  const content = minimalContent();
  content.legs[0].map = {
    kind: "tiles",
    bounds: [34.82, 32.11, 34.8, 32.09],
    minZoom: 18,
    maxZoom: 13,
  };
  const { errors } = contentInvariants(content);
  assert.deepEqual(paths(errors).slice(0, 3), [
    "/legs/0/map/bounds",
    "/legs/0/map/bounds",
    "/legs/0/map",
  ]);
});

test("9. hint costs above the station's points only warn", () => {
  const content = minimalContent();
  content.legs[0].stations[0].hints = [
    { text: L("א", "a"), cost: 60 },
    { text: L("ב", "b"), cost: 60 },
  ];
  const report = contentInvariants(content);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(paths(report.warnings), ["/legs/0/stations/0/hints"]);
});

test("10. a first station that is not a pin only warns, and only when progressive", () => {
  const content = minimalContent();
  content.legs[0].stations[0].reveal = { as: "clue", clue: { text: L("רמז", "Clue") } };
  assert.deepEqual(paths(contentInvariants(content).warnings), ["/legs/0/stations/0/reveal/as"]);
  content.rules.visibility = "all";
  assert.deepEqual(contentInvariants(content).warnings, []);
});

test("11. media size warns above 50 MB and errors above 100 MB, before map data", () => {
  const content = minimalContent();
  content.media = [{ id: MEDIA_A, kind: "image", path: "media/huge.jpg", alt: L("ענק", "Huge") }];
  assert.deepEqual(
    paths(contentInvariants(content, { mediaBytes: () => 60 * 1024 * 1024 }).warnings),
    ["/media"],
  );
  assert.deepEqual(
    paths(contentInvariants(content, { mediaBytes: () => 101 * 1024 * 1024 }).errors),
    ["/media"],
  );
});

test("12. a qr station without a token only warns", () => {
  const content = minimalContent();
  content.legs[0].stations[0].arrival.methods = ["qr"];
  const report = contentInvariants(content);
  assert.deepEqual(report.errors, []);
  assert.deepEqual(paths(report.warnings), ["/legs/0/stations/0/arrival/qrToken"]);
});

test("fixtures used for invariant tests still pass the schema", () => {
  assert.deepEqual(schemaIssues("content", minimalContent()), []);
});

test("tenant: theme text colors need 4.5:1 contrast and languages must be complete", () => {
  const tenant = minimalTenant();
  tenant.theme.onPrimary = "#2A6A48";
  tenant.about = { he: "אודות" };
  tenant.defaultLanguage = "fr";
  const { errors } = tenantInvariants(tenant);
  assert.deepEqual(paths(errors), ["/defaultLanguage", "/about", "/theme/onPrimary"]);
  assert.match(errors[2]!.message, /below 4.5:1/);
});
