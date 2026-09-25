import { sql } from "drizzle-orm";
import { check, index, integer, primaryKey, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// courses.user_id has no drizzle `.references()` to auth's accountsTable:
// drizzle-kit loads schema files with a plain require() that cannot follow
// NodeNext `.js` imports across modules (CLAUDE.md, Spécificités SQLite).
// `REFERENCES accounts(id) ON DELETE CASCADE`, and the DESC direction of
// idx_courses_user_last_accessed, are added by hand in the generated
// migration, and pinned by sqlite-course-repository.int.test.ts.
export const coursesTable = sqliteTable(
  "courses",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull().default(""),
    subject: text("subject"),
    grade: text("grade").notNull(),
    color: text("color").notNull().default(""),
    extractionStatus: text("extraction_status").notNull(),
    confirmed: integer("confirmed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    lastAccessedAt: text("last_accessed_at").notNull(),
  },
  (table) => [
    check("courses_grade_check", sql`${table.grade} IN ('CP','CE1','CE2','CM1','CM2','6e')`),
    check("courses_subject_check", sql`${table.subject} IN ('maths','french','history','geography','science','english','other')`),
    // `failed` is never stored: it is derived from the latest job.
    check("courses_extraction_status_check", sql`${table.extractionStatus} IN ('pending','running','illegible','not_a_course_page','ready')`),
    index("idx_courses_user_last_accessed").on(table.userId, table.lastAccessedAt),
  ],
);

export const pagesTable = sqliteTable(
  "pages",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => coursesTable.id, { onDelete: "cascade" }),
    pageIndex: integer("page_index").notNull(),
    sha256: text("sha256").notNull(),
    storedPath: text("stored_path").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    legible: integer("legible", { mode: "boolean" }),
    isCoursePage: integer("is_course_page", { mode: "boolean" }),
    unusableReason: text("unusable_reason"),
  },
  (table) => [primaryKey({ columns: [table.courseId, table.pageIndex] }), unique("pages_course_sha256_unique").on(table.courseId, table.sha256)],
);

export const extractionsTable = sqliteTable("extractions", {
  courseId: text("course_id")
    .primaryKey()
    .references(() => coursesTable.id, { onDelete: "cascade" }),
  markdown: text("markdown").notNull(),
  extractedAt: text("extracted_at").notNull(),
});
