import type { Grade } from "../../auth/index.js";
import type { Result } from "../../shared/index.js";
import type { Classification, ClassificationError } from "./decision.js";
import type { Section } from "./split-into-sections.js";

export type CourseForTutor = { title: string; subject: string; grade: Grade; markdown: string };

// docs/modules/tutor.md, Ports. Called before any other model call; a
// light generateObject, never a stream.
export interface QuestionClassifier {
  classify(input: { question: string; course: CourseForTutor }): Promise<Result<Classification, ClassificationError>>;
}

export interface ChatModel {
  stream(input: { question: string; sections: Section[]; history: { role: "user" | "assistant"; content: string }[]; grade: Grade }): AsyncIterable<string>;
}

export type ExtractError = { kind: "invalid-output"; message: string };

export interface CitationExtractor {
  extract(input: { answer: string; sections: Section[] }): Promise<Result<{ sectionIndexes: number[] }, ExtractError>>;
}
