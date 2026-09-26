import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// items.course_id, course_generations.course_id and every user_id have no
// drizzle `.references()`: drizzle-kit loads schema files with a plain
// require() that cannot follow NodeNext `.js` imports across modules
// (CLAUDE.md, Spécificités SQLite). Their `REFERENCES ... ON DELETE
// CASCADE` are added by hand in the generated migration (0004), and
// pinned by sqlite-item-repository.int.test.ts.
export const itemsTable = sqliteTable(
  "items",
  {
    id: text("id").primaryKey(),
    courseId: text("course_id").notNull(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    gameTypesJson: text("game_types_json").notNull(),
    position: integer("position").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [unique("items_course_position_unique").on(table.courseId, table.position), index("idx_items_course").on(table.courseId, table.position)],
);

export const exercisesTable = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    itemId: text("item_id")
      .notNull()
      .references(() => itemsTable.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    contentJson: text("content_json").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("exercises_type_check", sql`${table.type} IN ('delayed_copy','mcq','matching','reordering','cloze','true_false','mental_math')`),
    unique("exercises_item_type_unique").on(table.itemId, table.type),
    index("idx_exercises_item").on(table.itemId),
  ],
);

export const courseGenerationsTable = sqliteTable(
  "course_generations",
  {
    courseId: text("course_id").primaryKey(),
    userId: text("user_id").notNull(),
    splitOutcome: text("split_outcome").notNull(),
    itemCount: integer("item_count").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [check("course_generations_split_outcome_check", sql`${table.splitOutcome} IN ('items_ready','insufficient_coverage')`)],
);
