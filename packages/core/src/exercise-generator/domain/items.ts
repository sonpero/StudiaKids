import { isGameType, type GameType } from "./game-types.js";

export const COVERAGE_MIN_ITEMS = 6; // the brief said 8; lowered by decision, 2026-09-26
export const COVERAGE_MAX_ITEMS = 40; // decided, revisable: beyond, the first 40 are kept
export const ITEM_MAX_GAME_TYPES = 3; // decided at M3's opening
const TITLE_MIN_CHARS = 3;
const TITLE_MAX_CHARS = 60;

export type SplitOutcome = "items_ready" | "insufficient_coverage";
export type ItemProposal = { title: string; body: string; applicableGameTypes: string[] };
export type ValidItem = { title: string; body: string; applicableGameTypes: GameType[]; position: number };

// The coverage check triggers exactly below 6 items (docs/jalons.md, M3;
// lowered from 8 on 2026-09-26: well-filled one-page lessons gave 7).
export function coverageOutcome(validItemCount: number): SplitOutcome {
  return validItemCount < COVERAGE_MIN_ITEMS ? "insufficient_coverage" : "items_ready";
}

function knownTypes(types: string[]): GameType[] {
  const kept: GameType[] = [];
  for (const type of types) if (isGameType(type) && !kept.includes(type)) kept.push(type);
  return kept.slice(0, ITEM_MAX_GAME_TYPES);
}

// What the splitter proposed, filtered: unknown game types dropped (at
// most 3 kept, in order), an item with no known type, a title outside
// 3–60 characters, an empty body or a title already used (case and
// spaces aside) dropped; positions contiguous from 0; at most 40 items.
export function validItems(proposals: ItemProposal[]): ValidItem[] {
  const seen = new Set<string>();
  const kept: ValidItem[] = [];
  for (const proposal of proposals) {
    const title = proposal.title.trim();
    const body = proposal.body.trim();
    const applicableGameTypes = knownTypes(proposal.applicableGameTypes);
    const key = title.toLowerCase().replace(/\s+/g, " ");
    if (title.length < TITLE_MIN_CHARS || title.length > TITLE_MAX_CHARS || body === "" || applicableGameTypes.length === 0 || seen.has(key)) continue;
    seen.add(key);
    kept.push({ title, body, applicableGameTypes, position: kept.length });
    if (kept.length === COVERAGE_MAX_ITEMS) break;
  }
  return kept;
}
