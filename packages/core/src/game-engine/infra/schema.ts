import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// user_id and exercise_id have no drizzle `.references()`: drizzle-kit
// loads schema files with a plain require() that cannot follow NodeNext
// `.js` imports across modules (CLAUDE.md, Spécificités SQLite). Their
// `REFERENCES ... ON DELETE CASCADE` are added by hand in the generated
// migration (0005), and pinned by sqlite-attempt-repository.int.test.ts.
// No column for the given answer, ever (docs/modules/game-engine.md,
// "Minimisation").
export const attemptsTable = sqliteTable(
  "attempts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    exerciseId: text("exercise_id").notNull(),
    type: text("type").notNull(),
    unitId: text("unit_id").notNull(),
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
