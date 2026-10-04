import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// user_id has no drizzle `.references()`: drizzle-kit loads schema files
// with a plain require() that cannot follow NodeNext `.js` imports across
// modules (CLAUDE.md, Spécificités SQLite). Its `REFERENCES accounts(id)
// ON DELETE CASCADE` is added by hand in the generated migrations (0005,
// then 0008), and pinned by sqlite-attempt-repository.int.test.ts.
// exercise_id has no reference at all since 0008: an attempt outlives its
// exercise, so that deleting a course never takes a star away.
// No column for the given answer, ever (docs/modules/game-engine.md,
// "Minimisation").
export const attemptsTable = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    exerciseId: text("exercise_id").notNull(),
    // Null once detached: a deleted course's attempts keep only what stars
    // and the streak need (docs/modules/game-engine.md).
    type: text("type"),
    unitId: text("unit_id"),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    starEligible: integer("star_eligible", { mode: "boolean" }).notNull().default(true),
    attemptedAt: text("attempted_at").notNull(),
  },
  (table) => [
    check("attempts_type_check", sql`${table.type} IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math')`),
    index("idx_attempts_user").on(table.userId, table.attemptedAt),
    index("idx_attempts_exercise").on(table.exerciseId),
  ],
);
