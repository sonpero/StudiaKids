import { createHash } from "node:crypto";
import { err, ok, type Result } from "../../shared/index.js";
import { canAddPage, nextPageIndex } from "../domain/pages.js";
import { isAcceptable, MAX_PAGE_BYTES, stripJpegMetadata } from "../domain/photo.js";
import type { CourseRepository, FileStore } from "../domain/ports.js";
import type { Page } from "../domain/types.js";
import type { NotFound } from "./errors.js";

export interface AddPageDeps {
  repo: CourseRepository;
  fileStore: FileStore;
}

export type AddPageError = NotFound | "locked" | "unsupported" | "too-large" | "too-many-pages" | "duplicate";

// The announced MIME type is never consulted: only the bytes are
// (docs/modules/ingestion.md). What gets hashed and stored is the photo
// without its metadata.
export async function addPage(deps: AddPageDeps, userId: string, courseId: string, bytes: Uint8Array, _now: Date): Promise<Result<Page, AddPageError>> {
  const course = await deps.repo.findCourse(userId, courseId);
  if (!course) return err("not-found");
  if (course.extractionStatus !== "pending") return err("locked");
  if (!isAcceptable(bytes)) return err(bytes.length > MAX_PAGE_BYTES ? "too-large" : "unsupported");
  if (!canAddPage(course.pageCount)) return err("too-many-pages");

  const stripped = stripJpegMetadata(bytes);
  if (!stripped.ok) return err("unsupported");
  const photo = stripped.value;

  const sha256 = createHash("sha256").update(photo).digest("hex");
  const existing = await deps.repo.listPages(userId, courseId);
  if (existing.some((page) => page.sha256 === sha256)) return err("duplicate");

  const index = nextPageIndex(existing.map((page) => page.index));
  const storedPath = await deps.fileStore.put(userId, courseId, index, photo);
  const page: Page = { courseId, index, sha256, storedPath, sizeBytes: photo.length, legible: null, isCoursePage: null, unusableReason: null };
  await deps.repo.addPage(userId, page);
  return ok(page);
}
