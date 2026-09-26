import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { imageMetadataProblem } from "./image-metadata.js";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const fixturesRoot = path.join(repoRoot, "tests/fixtures");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

// What a commit could carry: tracked files (staged included) and untracked
// ones git does not ignore. A gitignored file cannot be committed without
// --force. Without git (an exported tree), every file on disk.
function committableFixtures(): string[] {
  try {
    const listed = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "tests/fixtures"], { cwd: repoRoot, encoding: "utf8" });
    return listed.split("\0").filter(Boolean).map((file) => path.join(repoRoot, file));
  } catch {
    return filesUnder(fixturesRoot);
  }
}

// Decided at M2 (2026-09-26), after a raw phone photo was staged under
// tests/fixtures: no committable image there may carry metadata (EXIF,
// GPS, XMP...), whatever its extension's case. pnpm test, hence CI, fail
// on it; so does the optional pre-commit hook (.githooks/pre-commit).
describe("tests/fixtures holds no image with metadata", () => {
  it("every image is stripped", () => {
    const problems = committableFixtures().flatMap((file) => {
      const problem = imageMetadataProblem(file, new Uint8Array(readFileSync(file)));
      return problem ? [`${path.relative(fixturesRoot, file)}: ${problem}`] : [];
    });

    expect(problems).toEqual([]);
  });
});
