import type { LanguageModel } from "ai";
import { z } from "zod";
import type { Grade } from "../../auth/index.js";
import { generateWithRetry } from "../../ingestion/index.js";
import type { Result } from "../../shared/index.js";
import { GAME_TYPES } from "../domain/game-types.js";
import type { ItemProposal } from "../domain/items.js";
import type { GenerationError, ItemSplitter } from "../domain/ports.js";
import { splitPrompt } from "./prompts.js";

// Game types as plain strings: an unknown one is dropped in domain/, item
// by item, never refusing the whole split.
const splitSchema = z.object({
  items: z
    .array(
      z.object({
        title: z.string().describe("Un groupe nominal court, 3 à 60 caractères, distinct des autres titres."),
        body: z.string().describe("Le passage de la leçon, recopié : se comprend lu seul."),
        gameTypes: z.array(z.string()).describe(`1 à 3 types parmi : ${GAME_TYPES.join(", ")}.`),
      }),
    )
    .describe("Les items, dans l'ordre de la leçon."),
});

export class ClaudeItemSplitter implements ItemSplitter {
  constructor(private readonly model: LanguageModel) {}

  async split(input: { markdown: string; grade: Grade }): Promise<Result<ItemProposal[], GenerationError>> {
    const result = await generateWithRetry(this.model, splitSchema, (feedback) => [
      { role: "user", content: `${splitPrompt(input.grade, input.markdown)}${feedback ? `\n\n${feedback}` : ""}` },
    ]);
    if (!result.ok) return { ok: false, error: { kind: "model-error", message: result.error.message } };
    return { ok: true, value: result.value.items.map((item) => ({ title: item.title, body: item.body, applicableGameTypes: item.gameTypes })) };
  }
}
