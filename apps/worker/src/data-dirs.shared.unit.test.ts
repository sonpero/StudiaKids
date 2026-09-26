import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_DATA_ROOT } from "./data-dirs.js";

function repositoryRoot(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) throw new Error("no pnpm-workspace.yaml above this test");
    dir = parent;
  }
  return dir;
}

// Decided at M2 (2026-09-26): under pnpm dev each app runs from its own
// folder, and a cwd-relative ./data gave the API and the worker two
// databases — jobs were never picked up. Without a volume, both (and the
// CLI) use the repository's data/.
describe("the local data root, without RAILWAY_VOLUME_MOUNT_PATH", () => {
  it("is the repository's data/, whatever the process's cwd", () => {
    expect(DEFAULT_DATA_ROOT).toBe(path.join(repositoryRoot(), "data"));
  });
});
