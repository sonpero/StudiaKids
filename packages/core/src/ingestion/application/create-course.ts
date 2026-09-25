import type { Grade } from "../../auth/index.js";
import { ok, type IdGenerator, type Result } from "../../shared/index.js";
import type { CourseRepository, FileStore } from "../domain/ports.js";
import { deleteCourse } from "./delete-course.js";

export interface CreateCourseDeps {
  repo: CourseRepository;
  fileStore: FileStore;
  idGenerator: IdGenerator;
}

// One unconfirmed course per account: a new photo replaces the pending one,
// files included, so an abandoned photo never outlives the next course and
// no deferred clean-up is needed (docs/modules/ingestion.md). The grade is
// the authenticated account's, never guessed.
export async function createCourse(deps: CreateCourseDeps, userId: string, grade: Grade, now: Date): Promise<Result<{ id: string }, never>> {
  const previous = await deps.repo.findUnconfirmedCourse(userId);
  if (previous) await deleteCourse(deps, userId, previous.id);

  const id = deps.idGenerator.next();
  const nowIso = now.toISOString();
  await deps.repo.insertCourse({
    id,
    userId,
    title: "",
    subject: null,
    grade,
    color: "",
    extractionStatus: "pending",
    confirmed: false,
    pageCount: 0,
    createdAt: nowIso,
    lastAccessedAt: nowIso,
  });
  return ok({ id });
}
