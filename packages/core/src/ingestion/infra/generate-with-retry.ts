import { generateObject, NoObjectGeneratedError, type CoreMessage, type LanguageModel } from "ai";
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

type Issue = { code?: string; expected?: string; received?: string; path?: (string | number)[] };

// Zod issues of a validation failure, found down the error's cause chain.
function issuesOf(error: unknown): Issue[] {
  for (let cause: unknown = error, depth = 0; cause instanceof Error && depth < 5; cause = cause.cause, depth++) {
    const found = (cause as { issues?: unknown }).issues;
    if (Array.isArray(found)) return found as Issue[];
  }
  return [];
}

// A string that should have been an array or an object: decoded (up to
// three times), then unwrapped if it repeats its own key.
function decode(value: unknown, key: string | number | undefined): unknown {
  let decoded = value;
  for (let i = 0; i < 3 && typeof decoded === "string"; i++) {
    try {
      decoded = JSON.parse(decoded) as unknown;
    } catch {
      return value;
    }
  }
  if (key !== undefined && decoded !== null && typeof decoded === "object" && !Array.isArray(decoded) && String(key) in decoded) {
    return (decoded as Record<string, unknown>)[String(key)];
  }
  return decoded;
}

// claude-sonnet-5 sends a root array JSON-encoded in a string in most
// calls, sometimes re-wrapped in its own key (M3 dry-run: 6 calls out of
// 7). Only the fields Zod reports as "string received, array or object
// expected" are decoded: a string meant to be a string is never touched.
export function repairStringifiedValues({ text, error }: { text: string; error: unknown }): Promise<string | null> {
  const targets = issuesOf(error).filter(
    (issue) => issue.code === "invalid_type" && issue.received === "string" && (issue.expected === "array" || issue.expected === "object") && issue.path !== undefined,
  );
  if (targets.length === 0) return Promise.resolve(null);
  try {
    const root = JSON.parse(text) as unknown;
    for (const { path } of targets) {
      const keys = path ?? [];
      if (keys.length === 0) continue;
      let parent: unknown = root;
      for (const key of keys.slice(0, -1)) parent = parent !== null && typeof parent === "object" ? (parent as Record<string, unknown>)[String(key)] : undefined;
      const last = keys[keys.length - 1];
      if (parent !== null && typeof parent === "object" && last !== undefined) {
        const holder = parent as Record<string, unknown>;
        holder[String(last)] = decode(holder[String(last)], last);
      }
    }
    return Promise.resolve(JSON.stringify(root));
  } catch {
    return Promise.resolve(null);
  }
}

// The answer that came back but broke the schema, if any.
function parsedOutput(error: unknown): unknown {
  if (!NoObjectGeneratedError.isInstance(error) || error.text === undefined) return undefined;
  try {
    return JSON.parse(error.text) as unknown;
  } catch {
    return undefined;
  }
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
    const { object } = await generateObject({ model, schema, messages: buildMessages(null), experimental_repairText: repairStringifiedValues });
    return ok(object);
  } catch (firstError) {
    const feedback = `Ta réponse précédente n'a pas respecté le format attendu : ${describeError(firstError)}. Corrige et réessaie.`;
    try {
      const { object } = await generateObject({ model, schema, messages: buildMessages(feedback), experimental_repairText: repairStringifiedValues });
      return ok(object);
    } catch (secondError) {
      const lastOutput = parsedOutput(secondError);
      return err({ kind: "model-error", message: describeError(secondError), ...(lastOutput === undefined ? {} : { lastOutput }) });
    }
  }
}
