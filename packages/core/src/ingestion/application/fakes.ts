// In-memory test doubles for ingestion's ports (CLAUDE.md rule 3). No test
// reaches the filesystem, the network or SQLite through these.
import type { Job, JobQueue } from "../../jobs/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { CourseNamer, CourseNameSuggestion, CourseRepository, ExtractionError, FileStore, PhotoExtraction, PhotoExtractor } from "../domain/ports.js";
import type { Course, Extraction, Page } from "../domain/types.js";

export function fakeCourseRepository(): CourseRepository & { courses: Course[]; pages: Page[]; extractions: Extraction[] } {
  const courses: Course[] = [];
  const pages: Page[] = [];
  const extractions: Extraction[] = [];
  const owned = (userId: string, courseId: string) => courses.find((c) => c.id === courseId && c.userId === userId);
  const withCount = (course: Course): Course => ({ ...course, pageCount: pages.filter((p) => p.courseId === course.id).length });
  const removeWhere = <T>(rows: T[], predicate: (row: T) => boolean) => {
    for (let i = rows.length - 1; i >= 0; i--) if (predicate(rows[i] as T)) rows.splice(i, 1);
  };

  return {
    courses,
    pages,
    extractions,
    insertCourse: (course) => {
      courses.push({ ...course });
      return Promise.resolve();
    },
    findCourse: (userId, courseId) => {
      const course = owned(userId, courseId);
      return Promise.resolve(course ? withCount(course) : null);
    },
    findUnconfirmedCourse: (userId) => {
      const course = courses.find((c) => c.userId === userId && !c.confirmed);
      return Promise.resolve(course ? withCount(course) : null);
    },
    listConfirmedCourses: (userId) =>
      Promise.resolve(
        courses
          .filter((c) => c.userId === userId && c.confirmed)
          .sort((a, b) => b.lastAccessedAt.localeCompare(a.lastAccessedAt))
          .map(withCount),
      ),
    listPages: (userId, courseId) =>
      Promise.resolve(owned(userId, courseId) ? pages.filter((p) => p.courseId === courseId).sort((a, b) => a.index - b.index).map((p) => ({ ...p })) : []),
    addPage: (userId, page) => {
      if (!owned(userId, page.courseId)) throw new Error("course not owned");
      if (pages.some((p) => p.courseId === page.courseId && p.sha256 === page.sha256)) throw new Error("UNIQUE constraint failed");
      pages.push({ ...page });
      return Promise.resolve();
    },
    setExtractionStatus: (userId, courseId, status) => {
      const course = owned(userId, courseId);
      if (course) course.extractionStatus = status;
      return Promise.resolve();
    },
    resetPageResults: (userId, courseId) => {
      if (owned(userId, courseId)) {
        for (const p of pages.filter((row) => row.courseId === courseId)) Object.assign(p, { legible: null, isCoursePage: null, unusableReason: null });
      }
      return Promise.resolve();
    },
    recordPageResult: (userId, courseId, index, result) => {
      const page = owned(userId, courseId) ? pages.find((p) => p.courseId === courseId && p.index === index) : undefined;
      if (page) Object.assign(page, result);
      return Promise.resolve();
    },
    completeExtraction: (userId, courseId, result, now) => {
      const course = owned(userId, courseId);
      if (!course) return Promise.resolve();
      removeWhere(extractions, (e) => e.courseId === courseId);
      extractions.push({ courseId, markdown: result.markdown, extractedAt: now.toISOString() });
      Object.assign(course, { title: result.title, subject: result.subject, color: result.color, extractionStatus: "ready" });
      return Promise.resolve();
    },
    getExtraction: (userId, courseId) =>
      Promise.resolve(owned(userId, courseId) ? (extractions.find((e) => e.courseId === courseId) ?? null) : null),
    confirmCourse: (userId, courseId) => {
      const course = owned(userId, courseId);
      if (course) course.confirmed = true;
      return Promise.resolve();
    },
    touchCourse: (userId, courseId, now) => {
      const course = owned(userId, courseId);
      if (course) course.lastAccessedAt = now.toISOString();
      return Promise.resolve();
    },
    deleteCourse: (userId, courseId) => {
      const existed = Boolean(owned(userId, courseId));
      removeWhere(pages, (p) => p.courseId === courseId && existed);
      removeWhere(extractions, (e) => e.courseId === courseId && existed);
      removeWhere(courses, (c) => c.id === courseId && c.userId === userId);
      return Promise.resolve(existed);
    },
  };
}

export function fakeFileStore(): FileStore & { files: Map<string, Uint8Array>; calls: string[] } {
  const files = new Map<string, Uint8Array>();
  const calls: string[] = [];
  return {
    files,
    calls,
    put: (userId, courseId, pageIndex, bytes) => {
      const path = `photos/${userId}/${courseId}/${String(pageIndex)}.jpg`;
      files.set(path, bytes);
      calls.push(`put ${path}`);
      return Promise.resolve(path);
    },
    read: (storedPath) => {
      const bytes = files.get(storedPath);
      if (!bytes) throw new Error(`no file at ${storedPath}`);
      return Promise.resolve(bytes);
    },
    deleteCourse: (userId, courseId) => {
      for (const path of [...files.keys()]) if (path.startsWith(`photos/${userId}/${courseId}/`)) files.delete(path);
      calls.push(`deleteCourse ${userId}/${courseId}`);
      return Promise.resolve();
    },
  };
}

// Answers page by page, in call order; records what it was asked.
export function scriptedPhotoExtractor(answers: Result<PhotoExtraction, ExtractionError>[]): PhotoExtractor & { calls: number } {
  const extractor = {
    calls: 0,
    extract: () => {
      const answer = answers[extractor.calls] ?? err({ kind: "model-error" as const, message: "no scripted answer left" });
      extractor.calls++;
      return Promise.resolve(answer);
    },
  };
  return extractor;
}

export const legiblePage = (markdown: string): Result<PhotoExtraction, ExtractionError> => ok({ markdown, legible: true, isCoursePage: true });

export function scriptedCourseNamer(answer: Result<CourseNameSuggestion, ExtractionError>): CourseNamer & { inputs: string[] } {
  const inputs: string[] = [];
  return {
    inputs,
    suggest: ({ markdown }) => {
      inputs.push(markdown);
      return Promise.resolve(answer);
    },
  };
}

// Local JobQueue fake: jobs' own fakes are not part of its index.ts.
export function fakeJobQueue(): JobQueue & { rows: Job[] } {
  const rows: Job[] = [];
  return {
    rows,
    enqueue: (userId, type, payload, now) => {
      const id = `job-${String(rows.length)}`;
      const nowIso = now.toISOString();
      rows.push({ id, userId, type, payload, status: "pending", attempts: 0, maxAttempts: 3, lastError: null, runAfter: nowIso, createdAt: nowIso, updatedAt: nowIso });
      return Promise.resolve(id);
    },
    claimNext: () => Promise.resolve(null),
    complete: () => Promise.resolve(),
    fail: () => Promise.resolve(),
    recoverStale: () => Promise.resolve(0),
    listJobs: (userId, type) =>
      Promise.resolve(
        rows
          .filter((row) => row.userId === userId && row.type === type)
          .reverse()
          .map((row) => ({ id: row.id, status: row.status, payload: row.payload, lastError: row.lastError })),
      ),
  };
}

export const sequentialIds = () => {
  let n = 0;
  return { next: () => `course-${String(n++)}` };
};

// A structurally valid JPEG whose scan data carries `seed` (so two seeds
// give two different photos), optionally with an EXIF block holding GPS.
export function tinyJpeg(seed: number, options: { withGps?: boolean } = {}): Uint8Array {
  const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];
  const ascii = (text: string) => Array.from(text, (char) => char.charCodeAt(0));
  return Uint8Array.from([
    0xff, 0xd8,
    ...(options.withGps ? segment(0xe1, [...ascii("Exif"), 0, 0, ...ascii("GPS 48.85N 2.35E")]) : []),
    ...segment(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
    ...segment(0xda, [1, 1, 0, 0, 63, 0]),
    seed & 0xff, (seed >> 8) & 0xff,
    0xff, 0xd9,
  ]);
}
