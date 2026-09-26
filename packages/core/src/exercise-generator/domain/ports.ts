import type { Grade } from "../../auth/index.js";
import type { Result } from "../../shared/index.js";
import type { ExerciseContent } from "./exercises.js";
import type { GameType } from "./game-types.js";
import type { ItemProposal, SplitOutcome } from "./items.js";

export type GenerationError = { kind: "model-error"; message: string };

export type Item = {
  id: string;
  courseId: string;
  userId: string;
  title: string;
  body: string;
  applicableGameTypes: GameType[];
  position: number;
  createdAt: string;
};

export type Exercise = { id: string; itemId: string; userId: string; type: GameType; content: ExerciseContent; createdAt: string };

export interface ItemSplitter {
  split(input: { markdown: string; grade: Grade }): Promise<Result<ItemProposal[], GenerationError>>;
}

// One call for a type and every item carrying it; each exercise names its
// item by its number in the list. Checked exercise by exercise in domain/.
export interface ExerciseGenerator {
  generate(input: { type: GameType; items: { title: string; body: string }[]; courseMarkdown: string; grade: Grade }): Promise<Result<unknown[], GenerationError>>;
}

// The text of a confirmed, ready course, read from ingestion (wired in
// apps/): exercise-generator never reads ingestion's tables.
export interface CourseTextSource {
  read(userId: string, courseId: string): Promise<Result<{ markdown: string; grade: Grade }, "not-found" | "not-ready">>;
}

// Every method takes userId and filters on it (CLAUDE.md rule 1).
export interface ItemRepository {
  findSplitOutcome(userId: string, courseId: string): Promise<{ outcome: SplitOutcome; itemCount: number } | null>;
  // One transaction: the items (replacing any previous ones) and the
  // outcome, with the count of valid items the coverage was judged on.
  saveSplit(userId: string, courseId: string, split: { items: Item[]; outcome: SplitOutcome; itemCount: number }, now: Date): Promise<void>;
  listItems(userId: string, courseId: string): Promise<Item[]>; // by position
  findItem(userId: string, itemId: string): Promise<Item | null>;
  listExercises(userId: string, itemIds: string[], type?: GameType): Promise<Exercise[]>;
  // One transaction: removed first, then inserted.
  applyExercises(userId: string, change: { remove: string[]; insert: Exercise[] }): Promise<void>;
  countExercisesByCourse(userId: string): Promise<Record<string, number>>;
}
