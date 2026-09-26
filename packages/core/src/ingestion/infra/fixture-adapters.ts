import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { err, ok, type Result } from "../../shared/index.js";
import { jpegSize } from "../domain/photo.js";
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

const sizeKey = (size: { width: number; height: number }) => `${String(size.width)}x${String(size.height)}`;

// Stands in for ClaudePhotoExtractor in the worker when LLM_ADAPTER=fixture
// (e2e): photos/<case>.jpg (and extra photos photos/<case>.<n>.jpg) in the
// fixtures directory say which answer a photo gets, matched on its SIZE —
// the capture screen re-encodes every photo through a canvas, which
// changes every byte but keeps the size of a photo already at native size
// (docs/modules/ingestion.md). Never reaches the network; an unknown size
// is a loud failure, never an invented answer.
export class FixturePhotoExtractor implements PhotoExtractor {
  private readonly caseBySize = new Map<string, string>();

  constructor(private readonly fixturesDir: string) {
    const photosDir = path.join(fixturesDir, "photos");
    for (const file of readdirSync(photosDir).filter((name) => name.endsWith(".jpg"))) {
      const size = jpegSize(new Uint8Array(readFileSync(path.join(photosDir, file))));
      if (!size) throw new Error(`fixture photo has no readable size: ${file}`);
      const fixtureCase = file.slice(0, file.indexOf("."));
      const known = this.caseBySize.get(sizeKey(size));
      if (known !== undefined && known !== fixtureCase) {
        throw new Error(`fixture photos of "${known}" and "${fixtureCase}" share the size ${sizeKey(size)}: the answer would be ambiguous`);
      }
      this.caseBySize.set(sizeKey(size), fixtureCase);
    }
  }

  extract(input: { bytes: Uint8Array }): Promise<Result<PhotoExtraction, ExtractionError>> {
    const size = jpegSize(input.bytes);
    const fixtureCase = size ? this.caseBySize.get(sizeKey(size)) : undefined;
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
