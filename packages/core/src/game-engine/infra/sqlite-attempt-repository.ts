import { and, eq, inArray } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/better-sqlite3";
import { exercisesTable } from "../../exercise-generator/index.js";
import type { AttemptRecord } from "../domain/play.js";
import type { Attempt, AttemptRepository } from "../domain/ports.js";
import { attemptsTable } from "./schema.js";

export type GameEngineDb = ReturnType<typeof drizzle>;

// Append-only: rows are only ever inserted (docs/modules/game-engine.md).
export class SqliteAttemptRepository implements AttemptRepository {
  constructor(private readonly db: GameEngineDb) {}

  // One short transaction per submission: whole or nothing, and never on
  // an exercise the account does not own.
  record(userId: string, attempts: Attempt[], now: Date): Promise<void> {
    try {
      this.db.transaction((tx) => {
        const ids = [...new Set(attempts.map((attempt) => attempt.exerciseId))];
        const owned = ids.length === 0 ? [] : tx.select({ id: exercisesTable.id }).from(exercisesTable).where(and(eq(exercisesTable.userId, userId), inArray(exercisesTable.id, ids))).all();
        if (owned.length !== ids.length) throw new Error("exercise not owned");
        for (const attempt of attempts) {
          tx.insert(attemptsTable)
            .values({ ...attempt, userId, attemptedAt: now.toISOString() })
            .run();
        }
      });
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  listByUser(userId: string): Promise<AttemptRecord[]> {
    return Promise.resolve(
      this.db
        .select({ exerciseId: attemptsTable.exerciseId, attemptedAt: attemptsTable.attemptedAt, correct: attemptsTable.correct, starEligible: attemptsTable.starEligible })
        .from(attemptsTable)
        .where(eq(attemptsTable.userId, userId))
        .orderBy(attemptsTable.attemptedAt, attemptsTable.id)
        .all(),
    );
  }

  listForExercises(userId: string, exerciseIds: string[]): Promise<AttemptRecord[]> {
    if (exerciseIds.length === 0) return Promise.resolve([]);
    return Promise.resolve(
      this.db
        .select({ exerciseId: attemptsTable.exerciseId, attemptedAt: attemptsTable.attemptedAt, correct: attemptsTable.correct, starEligible: attemptsTable.starEligible })
        .from(attemptsTable)
        .where(and(eq(attemptsTable.userId, userId), inArray(attemptsTable.exerciseId, exerciseIds)))
        .orderBy(attemptsTable.attemptedAt, attemptsTable.id)
        .all(),
    );
  }
}
