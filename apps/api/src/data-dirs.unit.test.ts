import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDataDirs } from "./data-dirs.js";

describe("resolveDataDirs", () => {
  let volumeRoot: string;
  afterEach(() => rmSync(volumeRoot, { recursive: true, force: true }));

  it("uses RAILWAY_VOLUME_MOUNT_PATH when set, never a hardcoded path", () => {
    volumeRoot = mkdtempSync(path.join(tmpdir(), "studiakids-volume-"));

    const dirs = resolveDataDirs({ RAILWAY_VOLUME_MOUNT_PATH: volumeRoot });

    expect(dirs.root).toBe(volumeRoot);
  });

  it("falls back to ./data (relative to cwd) when RAILWAY_VOLUME_MOUNT_PATH is unset", () => {
    volumeRoot = mkdtempSync(path.join(tmpdir(), "studiakids-cwd-"));

    const dirs = resolveDataDirs({}, volumeRoot);

    expect(dirs.root).toBe(path.join(volumeRoot, "data"));
  });

  it("creates db/ and photos/ under the root if they don't exist yet", () => {
    volumeRoot = mkdtempSync(path.join(tmpdir(), "studiakids-volume-"));

    const dirs = resolveDataDirs({ RAILWAY_VOLUME_MOUNT_PATH: volumeRoot });

    expect(dirs.dbDir).toBe(path.join(volumeRoot, "db"));
    expect(dirs.photosDir).toBe(path.join(volumeRoot, "photos"));
    expect(existsSync(dirs.dbDir)).toBe(true);
    expect(existsSync(dirs.photosDir)).toBe(true);
  });

  it("is idempotent: calling it again when the directories already exist does not throw", () => {
    volumeRoot = mkdtempSync(path.join(tmpdir(), "studiakids-volume-"));

    resolveDataDirs({ RAILWAY_VOLUME_MOUNT_PATH: volumeRoot });

    expect(() => resolveDataDirs({ RAILWAY_VOLUME_MOUNT_PATH: volumeRoot })).not.toThrow();
  });
});
