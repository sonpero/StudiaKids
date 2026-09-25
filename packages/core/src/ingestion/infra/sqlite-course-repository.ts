import { and, asc, count, desc, eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import type { Grade } from "../../auth/index.js";
import type { CompletedExtraction, CourseRepository, PageResult } from "../domain/ports.js";
import type { Subject } from "../domain/subject.js";
import type { Course, Extraction, Page, StoredExtractionStatus } from "../domain/types.js";
import { coursesTable, extractionsTable, pagesTable } from "./schema.js";

export type IngestionDb = ReturnType<typeof drizzle>;

type CourseRow = typeof coursesTable.$inferSelect;
type PageRow = typeof pagesTable.$inferSelect;

// Column values are guarded by CHECK constraints in the migration, so the
// narrowing casts below cannot see anything outside the closed lists.
function toCourse(row: CourseRow, pageCount: number): Course {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    subject: row.subject as Subject | null,
    grade: row.grade as Grade,
    color: row.color,
    extractionStatus: row.extractionStatus as StoredExtractionStatus,
    confirmed: row.confirmed,
    pageCount,
    createdAt: row.createdAt,
    lastAccessedAt: row.lastAccessedAt,
  };
}

function toPage(row: PageRow): Page {
  return {
    courseId: row.courseId,
    index: row.pageIndex,
    sha256: row.sha256,
    storedPath: row.storedPath,
    sizeBytes: row.sizeBytes,
    legible: row.legible,
    isCoursePage: row.isCoursePage,
    unusableReason: row.unusableReason,
  };
}

// Turns a synchronous better-sqlite3 throw (constraint violation) into a
// rejected promise, which Result-returning callers can see.
function attempt<T>(run: () => T): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }
}

// Every method filters on userId (CLAUDE.md rule 1). pages and extractions
// carry no user_id of their own: they are only ever reached through a
// course whose ownership is checked in the same statement or transaction.
export class SqliteCourseRepository implements CourseRepository {
  constructor(private readonly db: IngestionDb) {}

  private owned(userId: string, courseId: string) {
    return and(eq(coursesTable.id, courseId), eq(coursesTable.userId, userId));
  }

  private isOwned(userId: string, courseId: string): boolean {
    return this.db.select({ id: coursesTable.id }).from(coursesTable).where(this.owned(userId, courseId)).get() !== undefined;
  }

  private pageCount(courseId: string): number {
    return this.db.select({ n: count() }).from(pagesTable).where(eq(pagesTable.courseId, courseId)).get()?.n ?? 0;
  }

  insertCourse(course: Course): Promise<void> {
    return attempt(() => {
      const { pageCount: _pageCount, ...row } = course;
      this.db.insert(coursesTable).values(row).run();
    });
  }

  findCourse(userId: string, courseId: string): Promise<Course | null> {
    const row = this.db.select().from(coursesTable).where(this.owned(userId, courseId)).get();
    return Promise.resolve(row ? toCourse(row, this.pageCount(row.id)) : null);
  }

  findUnconfirmedCourse(userId: string): Promise<Course | null> {
    const row = this.db
      .select()
      .from(coursesTable)
      .where(and(eq(coursesTable.userId, userId), eq(coursesTable.confirmed, false)))
      .orderBy(desc(coursesTable.createdAt))
      .get();
    return Promise.resolve(row ? toCourse(row, this.pageCount(row.id)) : null);
  }

  listConfirmedCourses(userId: string): Promise<Course[]> {
    const rows = this.db
      .select()
      .from(coursesTable)
      .where(and(eq(coursesTable.userId, userId), eq(coursesTable.confirmed, true)))
      .orderBy(desc(coursesTable.lastAccessedAt))
      .all();
    return Promise.resolve(rows.map((row) => toCourse(row, this.pageCount(row.id))));
  }

  listPages(userId: string, courseId: string): Promise<Page[]> {
    if (!this.isOwned(userId, courseId)) return Promise.resolve([]);
    const rows = this.db.select().from(pagesTable).where(eq(pagesTable.courseId, courseId)).orderBy(asc(pagesTable.pageIndex)).all();
    return Promise.resolve(rows.map(toPage));
  }

  addPage(userId: string, page: Page): Promise<void> {
    return attempt(() =>
      this.db.transaction((tx) => {
        const owner = tx.select({ id: coursesTable.id }).from(coursesTable).where(this.owned(userId, page.courseId)).get();
        if (!owner) throw new Error(`course ${page.courseId} not found for this account`);
        tx.insert(pagesTable)
          .values({
            courseId: page.courseId,
            pageIndex: page.index,
            sha256: page.sha256,
            storedPath: page.storedPath,
            sizeBytes: page.sizeBytes,
            legible: page.legible,
            isCoursePage: page.isCoursePage,
            unusableReason: page.unusableReason,
          })
          .run();
      }),
    );
  }

  setExtractionStatus(userId: string, courseId: string, status: StoredExtractionStatus): Promise<void> {
    this.db.update(coursesTable).set({ extractionStatus: status }).where(this.owned(userId, courseId)).run();
    return Promise.resolve();
  }

  resetPageResults(userId: string, courseId: string): Promise<void> {
    if (this.isOwned(userId, courseId)) {
      this.db.update(pagesTable).set({ legible: null, isCoursePage: null, unusableReason: null }).where(eq(pagesTable.courseId, courseId)).run();
    }
    return Promise.resolve();
  }

  recordPageResult(userId: string, courseId: string, index: number, result: PageResult): Promise<void> {
    if (this.isOwned(userId, courseId)) {
      this.db
        .update(pagesTable)
        .set(result)
        .where(and(eq(pagesTable.courseId, courseId), eq(pagesTable.pageIndex, index)))
        .run();
    }
    return Promise.resolve();
  }

  // One short transaction, no model call inside (CLAUDE.md rule 2): the
  // extraction only ever exists alongside a `ready` course.
  completeExtraction(userId: string, courseId: string, result: CompletedExtraction, now: Date): Promise<void> {
    this.db.transaction((tx) => {
      const owner = tx.select({ id: coursesTable.id }).from(coursesTable).where(this.owned(userId, courseId)).get();
      if (!owner) return;
      tx.delete(extractionsTable).where(eq(extractionsTable.courseId, courseId)).run();
      tx.insert(extractionsTable).values({ courseId, markdown: result.markdown, extractedAt: now.toISOString() }).run();
      tx.update(coursesTable)
        .set({ title: result.title, subject: result.subject, color: result.color, extractionStatus: "ready" })
        .where(eq(coursesTable.id, courseId))
        .run();
    });
    return Promise.resolve();
  }

  getExtraction(userId: string, courseId: string): Promise<Extraction | null> {
    if (!this.isOwned(userId, courseId)) return Promise.resolve(null);
    const row = this.db.select().from(extractionsTable).where(eq(extractionsTable.courseId, courseId)).get();
    return Promise.resolve(row ? { courseId: row.courseId, markdown: row.markdown, extractedAt: row.extractedAt } : null);
  }

  confirmCourse(userId: string, courseId: string): Promise<void> {
    this.db.update(coursesTable).set({ confirmed: true }).where(this.owned(userId, courseId)).run();
    return Promise.resolve();
  }

  touchCourse(userId: string, courseId: string, now: Date): Promise<void> {
    this.db.update(coursesTable).set({ lastAccessedAt: now.toISOString() }).where(this.owned(userId, courseId)).run();
    return Promise.resolve();
  }

  // Pages and extraction follow by ON DELETE CASCADE.
  deleteCourse(userId: string, courseId: string): Promise<boolean> {
    const result = this.db.delete(coursesTable).where(this.owned(userId, courseId)).run();
    return Promise.resolve(result.changes > 0);
  }
}
