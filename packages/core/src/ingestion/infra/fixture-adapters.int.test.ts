import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FixtureCourseNamer, FixturePhotoExtractor } from "./fixture-adapters.js";

const fixturesDir = fileURLToPath(new URL("../../../../../tests/fixtures/ingestion/synthetic", import.meta.url));
const photo = (fixtureCase: string) => new Uint8Array(readFileSync(`${fixturesDir}/photos/${fixtureCase}.jpg`));

// The fixture adapters stand in for the model in the worker when
// LLM_ADAPTER=fixture: the photo's SHA-256 picks the recorded answer.
describe("FixturePhotoExtractor", () => {
  const extractor = new FixturePhotoExtractor(fixturesDir);

  it("answers the legible fixture for the legible photo, with a heading hierarchy", async () => {
    const result = await extractor.extract({ bytes: photo("legible") });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ legible: true, isCoursePage: true });
    expect(result.value.markdown).toMatch(/^# \S/m);
  });

  it("answers illegible, with a reason, for the blurred photo", async () => {
    const result = await extractor.extract({ bytes: photo("illegible") });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.legible).toBe(false);
    expect(result.value.reason?.length).toBeGreaterThan(0);
  });

  it("answers not a course page for the photo with no lesson", async () => {
    const result = await extractor.extract({ bytes: photo("not-a-course") });

    if (!result.ok) throw new Error(result.error.message);
    expect(result.value).toMatchObject({ legible: true, isCoursePage: false });
  });

  it("fails loudly on a photo it has no fixture for, rather than inventing an answer", async () => {
    const result = await extractor.extract({ bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]) });

    expect(result).toMatchObject({ ok: false, error: { kind: "model-error" } });
    if (!result.ok) expect(result.error.message).toMatch(/no fixture/i);
  });
});

// Decision (M2): photos are matched on their size, because the capture
// screen re-encodes every photo through a canvas (new bytes, same size for
// a photo already at native size).
describe("FixturePhotoExtractor matches on the photo's size", () => {
  const extractor = new FixturePhotoExtractor(fixturesDir);
  const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  const jpegOfSize = (width: number, height: number) =>
    Uint8Array.from([0xff, 0xd8, ...segment(0xc0, [8, height >> 8, height & 0xff, width >> 8, width & 0xff, 3]), 0xff, 0xd9]);
  const sizeOf = (fixtureCase: string) => {
    const bytes = photo(fixtureCase);
    for (let i = 2; i < bytes.length - 8; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xc0) return { height: (bytes[i + 5]! << 8) | bytes[i + 6]!, width: (bytes[i + 7]! << 8) | bytes[i + 8]! };
    }
    throw new Error("no frame header");
  };

  it("a different photo of the same size as the blurred one gets the illegible answer (a canvas re-encoding)", async () => {
    const { width, height } = sizeOf("illegible");

    const result = await extractor.extract({ bytes: jpegOfSize(width, height) });

    expect(result).toMatchObject({ ok: true, value: { legible: false } });
  });

  it("every case has its own size, and extra photos of a case (legible.2.jpg...) share its answer", async () => {
    const sizes = ["legible", "illegible", "not-a-course"].map((fixtureCase) => JSON.stringify(sizeOf(fixtureCase)));
    expect(new Set(sizes).size).toBe(3);

    for (const extra of ["legible.2", "legible.3"]) {
      expect(await extractor.extract({ bytes: photo(extra) })).toMatchObject({ ok: true, value: { legible: true, isCoursePage: true } });
    }
  });

  it("refuses a fixtures directory where two cases share a size: the answer would be ambiguous", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "studiakids-fixtures-"));
    try {
      mkdirSync(path.join(dir, "photos"));
      copyFileSync(`${fixturesDir}/photos/legible.jpg`, path.join(dir, "photos", "legible.jpg"));
      copyFileSync(`${fixturesDir}/photos/legible.jpg`, path.join(dir, "photos", "illegible.jpg"));

      expect(() => new FixturePhotoExtractor(dir)).toThrow(/legible.*illegible|illegible.*legible/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("FixtureCourseNamer", () => {
  it("answers the namer fixture's title and subject", async () => {
    const result = await new FixtureCourseNamer(fixturesDir).suggest({ markdown: "# Le verbe" });

    expect(result).toEqual({ ok: true, value: { title: "Le verbe", subject: "french" } });
  });
});
