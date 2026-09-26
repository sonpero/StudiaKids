import { generateObject, type CoreMessage, type LanguageModel } from "ai";
import type { ZodType } from "zod";
import { err, ok, type Result } from "../../shared/index.js";
import type { ExtractionError } from "../domain/ports.js";

// The SDK's own message is generic ("response did not match schema"); the
// rule the model broke lives in the Zod issues down the cause chain, and
// that is what it must be told (CLAUDE.md rule 4).
function describeError(error: unknown): string {
  const issues: string[] = [];
  for (let cause: unknown = error, depth = 0; cause instanceof Error && depth < 5; cause = cause.cause, depth++) {
    const found = (cause as { issues?: unknown }).issues;
    if (Array.isArray(found)) issues.push(...found.map((issue: { message?: unknown }) => String(issue.message)));
  }
  if (issues.length > 0) return issues.join(" ");
  return error instanceof Error ? error.message : String(error);
}

// One schema, one call; on a validation failure, exactly one retry with the
// error fed back to the model, then give up (CLAUDE.md rule 4). The caller
// (a job handler) turns the error into a failed attempt.
export async function generateWithRetry<T>(
  model: LanguageModel,
  schema: ZodType<T>,
  buildMessages: (feedback: string | null) => CoreMessage[],
): Promise<Result<T, ExtractionError>> {
  try {
    const { object } = await generateObject({ model, schema, messages: buildMessages(null) });
    return ok(object);
  } catch (firstError) {
    const feedback = `Ta réponse précédente n'a pas respecté le format attendu : ${describeError(firstError)}. Corrige et réessaie.`;
    try {
      const { object } = await generateObject({ model, schema, messages: buildMessages(feedback) });
      return ok(object);
    } catch (secondError) {
      return err({ kind: "model-error", message: describeError(secondError) });
    }
  }
}
