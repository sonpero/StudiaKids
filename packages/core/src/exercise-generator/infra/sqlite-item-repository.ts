import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import type { ExerciseContent } from "../domain/exercises.js";
import type { GameType } from "../domain/game-types.js";
import type { SplitOutcome } from "../domain/items.js";
import type { Exercise, Item, ItemRepository } from "../domain/ports.js";
import { courseGenerationsTable, exercisesTable, itemsTable } from "./schema.js";

export type ExerciseGeneratorDb = ReturnType<typeof drizzle>;

type ItemRow = typeof itemsTable.$inferSelect;
type ExerciseRow = typeof exercisesTable.$inferSelect;

const toItem = (row: ItemRow): Item => ({
  id: row.id,
  courseId: row.courseId,
  userId: row.userId,
  title: row.title,
  body: row.body,
  applicableGameTypes: JSON.parse(row.gameTypesJson) as GameType[],
  position: row.position,
  createdAt: row.createdAt,
});

const toExercise = (row: ExerciseRow): Exercise => ({
  id: row.id,
  itemId: row.itemId,
  userId: row.userId,
  type: row.type as GameType,
  content: JSON.parse(row.contentJson) as ExerciseContent,
  createdAt: row.createdAt,
});

// Every method filters on userId (CLAUDE.md rule 1); a course or an item
// of another account reads as absent and is never written.
export class SqliteItemRepository implements ItemRepository {
  constructor(private readonly db: ExerciseGeneratorDb) {}

  private ownsCourse(userId: string, courseId: string): boolean {
    // ingestion's table, read through a bound query: its schema is internal.
    const row = this.db.get<{ n: number }>(sql`SELECT count(*) AS n FROM courses WHERE id = ${courseId} AND user_id = ${userId}`);
    return row.n > 0;
  }

  findSplitOutcome(userId: string, courseId: string): Promise<{ outcome: SplitOutcome; itemCount: number } | null> {
    const row = this.db
      .select()
      .from(courseGenerationsTable)
      .where(and(eq(courseGenerationsTable.courseId, courseId), eq(courseGenerationsTable.userId, userId)))
      .get();
    return Promise.resolve(row ? { outcome: row.splitOutcome as SplitOutcome, itemCount: row.itemCount } : null);
  }

  // One short transaction, no model call inside (CLAUDE.md rule 2).
  saveSplit(userId: string, courseId: string, split: { items: Item[]; outcome: SplitOutcome; itemCount: number }, now: Date): Promise<void> {
    if (!this.ownsCourse(userId, courseId)) return Promise.resolve();
    this.db.transaction((tx) => {
      tx.delete(itemsTable).where(and(eq(itemsTable.courseId, courseId), eq(itemsTable.userId, userId))).run();
      for (const item of split.items) {
        tx.insert(itemsTable)
          .values({ id: item.id, courseId, userId, title: item.title, body: item.body, gameTypesJson: JSON.stringify(item.applicableGameTypes), position: item.position, createdAt: item.createdAt })
          .run();
      }
      const values = { courseId, userId, splitOutcome: split.outcome, itemCount: split.itemCount, updatedAt: now.toISOString() };
      tx.insert(courseGenerationsTable)
        .values(values)
        .onConflictDoUpdate({ target: courseGenerationsTable.courseId, set: { splitOutcome: values.splitOutcome, itemCount: values.itemCount, updatedAt: values.updatedAt } })
        .run();
    });
    return Promise.resolve();
  }

  listItems(userId: string, courseId: string): Promise<Item[]> {
    const rows = this.db
      .select()
      .from(itemsTable)
      .where(and(eq(itemsTable.courseId, courseId), eq(itemsTable.userId, userId)))
      .orderBy(itemsTable.position)
      .all();
    return Promise.resolve(rows.map(toItem));
  }

  findItem(userId: string, itemId: string): Promise<Item | null> {
    const row = this.db
      .select()
      .from(itemsTable)
      .where(and(eq(itemsTable.id, itemId), eq(itemsTable.userId, userId)))
      .get();
    return Promise.resolve(row ? toItem(row) : null);
  }

  findExercise(userId: string, exerciseId: string): Promise<Exercise | null> {
    const row = this.db
      .select()
      .from(exercisesTable)
      .where(and(eq(exercisesTable.userId, userId), eq(exercisesTable.id, exerciseId), eq(exercisesTable.retired, false)))
      .get();
    return Promise.resolve(row ? toExercise(row) : null);
  }

  listExercises(userId: string, itemIds: string[], type?: GameType): Promise<Exercise[]> {
    if (itemIds.length === 0) return Promise.resolve([]);
    const filters = [eq(exercisesTable.userId, userId), inArray(exercisesTable.itemId, itemIds), eq(exercisesTable.retired, false)];
    if (type !== undefined) filters.push(eq(exercisesTable.type, type));
    return Promise.resolve(this.db.select().from(exercisesTable).where(and(...filters)).all().map(toExercise));
  }

  // One transaction: removed first, then inserted; a failure rolls back
  // the whole change (UNIQUE (item_id, type) never allows a duplicate).
  // An exercise that was played is never deleted: its stars are derived
  // from its attempts, which would go with it.
  applyExercises(userId: string, change: { remove: string[]; insert: Exercise[] }): Promise<void> {
    try {
      this.write(userId, change);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private write(userId: string, change: { remove: string[]; insert: Exercise[] }): void {
    this.db.transaction((tx) => {
      const slot = (itemId: string, type: string) => `${itemId}\u0000${type}`;
      // game-engine's table, read through a bound query: its schema is internal.
      const played = new Set(
        change.remove.length === 0
          ? []
          : tx
              .all<{ exercise_id: string }>(sql`SELECT DISTINCT exercise_id FROM attempts WHERE user_id = ${userId} AND exercise_id IN (${sql.join(change.remove.map((id) => sql`${id}`), sql`, `)})`)
              .map((row) => row.exercise_id),
      );
      const replaced = new Set(change.insert.map((exercise) => slot(exercise.itemId, exercise.type)));
      const removed = change.remove.length === 0 ? [] : tx.select().from(exercisesTable).where(and(eq(exercisesTable.userId, userId), inArray(exercisesTable.id, change.remove))).all();
      // Played and replaced: it stays as it is, and its slot takes nothing new.
      const kept = new Set(removed.filter((row) => played.has(row.id) && replaced.has(slot(row.itemId, row.type))).map((row) => slot(row.itemId, row.type)));
      const retire = removed.filter((row) => played.has(row.id) && !kept.has(slot(row.itemId, row.type))).map((row) => row.id);
      const remove = removed.filter((row) => !played.has(row.id)).map((row) => row.id);
      if (remove.length > 0) tx.delete(exercisesTable).where(inArray(exercisesTable.id, remove)).run();
      if (retire.length > 0) tx.update(exercisesTable).set({ retired: true }).where(inArray(exercisesTable.id, retire)).run();
      for (const exercise of change.insert) {
        if (kept.has(slot(exercise.itemId, exercise.type))) continue;
        // A retired exercise keeps its slot: nothing new takes it.
        const held = tx
          .select({ id: exercisesTable.id })
          .from(exercisesTable)
          .where(and(eq(exercisesTable.itemId, exercise.itemId), eq(exercisesTable.type, exercise.type), eq(exercisesTable.retired, true)))
          .get();
        if (held) continue;
        const owned = tx.select({ id: itemsTable.id }).from(itemsTable).where(and(eq(itemsTable.id, exercise.itemId), eq(itemsTable.userId, userId))).get();
        if (!owned) throw new Error(`item ${exercise.itemId} not owned`);
        tx.insert(exercisesTable)
          .values({ id: exercise.id, itemId: exercise.itemId, userId, type: exercise.type, contentJson: JSON.stringify(exercise.content), createdAt: exercise.createdAt })
          .run();
      }
    });
  }

  listCourseExerciseIds(userId: string, courseId: string): Promise<string[]> {
    return Promise.resolve(
      this.db
        .select({ id: exercisesTable.id })
        .from(exercisesTable)
        .innerJoin(itemsTable, eq(itemsTable.id, exercisesTable.itemId))
        .where(and(eq(exercisesTable.userId, userId), eq(itemsTable.userId, userId), eq(itemsTable.courseId, courseId)))
        .all()
        .map((row) => row.id),
    );
  }

  countExercisesByCourse(userId: string): Promise<Record<string, number>> {
    const rows = this.db
      .select({ courseId: itemsTable.courseId, n: count(exercisesTable.id) })
      .from(exercisesTable)
      .innerJoin(itemsTable, eq(itemsTable.id, exercisesTable.itemId))
      .where(and(eq(exercisesTable.userId, userId), eq(exercisesTable.retired, false)))
      .groupBy(itemsTable.courseId)
      .all();
    return Promise.resolve(Object.fromEntries(rows.map((row) => [row.courseId, row.n])));
  }
}
