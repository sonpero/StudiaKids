import { err, ok, type Result } from "../../shared/index.js";
import type { CourseRepository, FileStore } from "../domain/ports.js";
import type { NotFound } from "./errors.js";

export interface ReadPageFileDeps {
  repo: CourseRepository;
  fileStore: FileStore;
}

// Ownership is checked through the repository before any file is read:
// photos are never served statically (CLAUDE.md, Fichiers).
export async function readPageFile(deps: ReadPageFileDeps, userId: string, courseId: string, index: number): Promise<Result<Uint8Array, NotFound>> {
  const pages = await deps.repo.listPages(userId, courseId);
  const page = pages.find((p) => p.index === index);
  if (!page) return err("not-found");
  return ok(await deps.fileStore.read(page.storedPath));
}
