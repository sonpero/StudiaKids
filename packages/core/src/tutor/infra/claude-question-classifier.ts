import type { LanguageModel } from "ai";
import { z } from "zod";
import { generateWithRetry } from "../../ingestion/index.js";
import { err, ok, type Result } from "../../shared/index.js";
import type { Classification, ClassificationError } from "../domain/decision.js";
import type { CourseForTutor, QuestionClassifier } from "../domain/ports.js";
import { classifierPrompt } from "./prompts.js";

const classificationSchema = z.object({
  onTopic: z.boolean().describe("La question porte sur le cours ou sur quelque chose en rapport avec son sujet."),
  sensitive: z.boolean().describe("La question est sensible au sens de la consigne (jamais à cause de la seule gravité du sujet du cours)."),
  distress: z.boolean().describe("Le message laisse penser que l'enfant est en danger ou en souffrance. En cas de doute : vrai."),
});

// A child waiting for an answer: past this, the question gets the fixed
// « ask again » message (docs/modules/tutor.md, M6).
export const CLASSIFIER_TIMEOUT_MS = 10_000;

// Never called by pnpm test (CLAUDE.md rule 3): the real adapter.
export class ClaudeQuestionClassifier implements QuestionClassifier {
  constructor(
    private readonly model: LanguageModel,
    private readonly timeoutMs = CLASSIFIER_TIMEOUT_MS,
  ) {}

  async classify(input: { question: string; course: CourseForTutor }): Promise<Result<Classification, ClassificationError>> {
    const prompt = classifierPrompt(input.question, input.course);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<Result<Classification, ClassificationError>>((resolve) => {
      timer = setTimeout(() => resolve(err({ kind: "model-error", message: "timeout" })), this.timeoutMs);
    });
    const call = generateWithRetry(this.model, classificationSchema, (feedback) => [{ role: "user", content: feedback ? `${prompt}\n\n${feedback}` : prompt }]).then(
      (result): Result<Classification, ClassificationError> => (result.ok ? ok(result.value) : err({ kind: "invalid-output", message: result.error.message })),
    );
    try {
      return await Promise.race([call, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
