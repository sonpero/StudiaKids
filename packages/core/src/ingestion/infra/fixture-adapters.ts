import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { err, ok, type Result } from "../../shared/index.js";
import { stripJpegMetadata } from "../domain/photo.js";
import type { CourseNamer, CourseNameSuggestion, ExtractionError, PhotoExtraction, PhotoExtractor } from "../domain/ports.js";
import { SUBJECTS } from "../domain/subject.js";

// A fixture file holds raw Messages API responses (docs/modules/ingestion.md,
// "Enregistrement des fixtures"); the answer is the first tool_use input.
const fixtureFileSchema = z.object({
  exchanges: z.array(z.object({ body: z.object({ content: z.array(z.object({ type: z.string(), input: z.unknown().optional() })) }) })),
});
const photoAnswerSchema = z.object({ markdown: z.string(), legible: z.boolean(), isCoursePage: z.boolean(), reason: z.string().optional() });
const namerAnswerSchema = z.object({ title: z.string(), subject: z.enum(SUBJECTS) });

function toolInput(fixturesDir: string, fixtureCase: string): unknown {
  const file = fixtureFileSchema.parse(JSON.parse(readFileSync(path.join(fixturesDir, `${fixtureCase}.json`), "utf8")));
  return file.exchanges[0]?.body.content.find((block) => block.type === "tool_use")?.input;
}

// Hashed without metadata on both sides, so a photo matches whether it
// comes as stored (already stripped by addPage) or straight from the file.
function photoKey(bytes: Uint8Array): string | null {
  const stripped = stripJpegMetadata(bytes);
  return stripped.ok ? createHash("sha256").update(stripped.value).digest("hex") : null;
}

// Stands in for ClaudePhotoExtractor in the worker when LLM_ADAPTER=fixture
// (e2e): photos/<case>.jpg in the fixtures directory says which answer a
// photo gets, matched on the SHA-256 of its bytes without metadata. Never reaches the network; an unknown photo is a loud failure.
export class FixturePhotoExtractor implements PhotoExtractor {
  private readonly caseByHash = new Map<string, string>();

  constructor(private readonly fixturesDir: string) {
    const photosDir = path.join(fixturesDir, "photos");
    for (const file of readdirSync(photosDir).filter((name) => name.endsWith(".jpg"))) {
      const key = photoKey(new Uint8Array(readFileSync(path.join(photosDir, file))));
      if (!key) throw new Error(`fixture photo is not a JPEG: ${file}`);
      this.caseByHash.set(key, path.basename(file, ".jpg"));
    }
  }

  extract(input: { bytes: Uint8Array }): Promise<Result<PhotoExtraction, ExtractionError>> {
    const key = photoKey(input.bytes);
    const fixtureCase = key ? this.caseByHash.get(key) : undefined;
    if (!fixtureCase) return Promise.resolve(err({ kind: "model-error", message: "no fixture for this photo" }));
    const { markdown, legible, isCoursePage, reason } = photoAnswerSchema.parse(toolInput(this.fixturesDir, fixtureCase));
    return Promise.resolve(ok(reason === undefined ? { markdown, legible, isCoursePage } : { markdown, legible, isCoursePage, reason }));
  }
}

export class FixtureCourseNamer implements CourseNamer {
  constructor(private readonly fixturesDir: string) {}

  // One namer fixture, whatever the text: synthetic runs have one legible case.
  suggest(_input: { markdown: string }): Promise<Result<CourseNameSuggestion, ExtractionError>> {
    return Promise.resolve(ok(namerAnswerSchema.parse(toolInput(this.fixturesDir, "namer"))));
  }
}
