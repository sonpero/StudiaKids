import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStore } from "../domain/ports.js";

const PHOTOS = "photos";

// A single path segment, never "." or "..": ids come from the application
// (UUIDs), but a photo path must never be steerable out of its course.
function segment(value: string): string {
  if (value === "" || value === "." || value === ".." || value.includes("/") || value.includes("\\") || value.includes("\0")) {
    throw new Error(`invalid path segment: ${JSON.stringify(value)}`);
  }
  return value;
}

// Files live at <volume>/photos/{userId}/{courseId}/{pageIndex}.jpg
// (CLAUDE.md, Fichiers). storedPath is relative to the volume root: the
// database never carries the filesystem layout of one machine.
export class LocalFileStore implements FileStore {
  private readonly photosRoot: string;

  constructor(private readonly volumeRoot: string) {
    this.photosRoot = path.resolve(volumeRoot, PHOTOS);
  }

  private courseDir(userId: string, courseId: string): string {
    return path.join(PHOTOS, segment(userId), segment(courseId));
  }

  async put(userId: string, courseId: string, pageIndex: number, bytes: Uint8Array): Promise<string> {
    const dir = this.courseDir(userId, courseId);
    await mkdir(path.join(this.volumeRoot, dir), { recursive: true });
    const storedPath = path.join(dir, `${String(Math.trunc(pageIndex))}.jpg`);
    await writeFile(path.join(this.volumeRoot, storedPath), bytes);
    return storedPath;
  }

  async read(storedPath: string): Promise<Uint8Array> {
    const absolute = path.resolve(this.volumeRoot, storedPath);
    if (!absolute.startsWith(this.photosRoot + path.sep)) throw new Error(`path outside the photos directory: ${storedPath}`);
    return new Uint8Array(await readFile(absolute));
  }

  // The whole course directory at once: a photo never outlives its course.
  async deleteCourse(userId: string, courseId: string): Promise<void> {
    await rm(path.join(this.volumeRoot, this.courseDir(userId, courseId)), { recursive: true, force: true });
  }

  async deleteAccountFiles(userId: string): Promise<void> {
    await rm(path.join(this.volumeRoot, PHOTOS, segment(userId)), { recursive: true, force: true });
  }
}
