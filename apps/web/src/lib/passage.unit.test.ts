import { describe, expect, it } from "vitest";
import { locatePassages } from "./passage.js";

const LESSON = "# Le verbe\n\n## 1. À quoi sert le verbe ?\n\nLe verbe indique ce que fait le sujet.\n\n\n- **chante** est le verbe ;\n- Léa est le sujet.\n\n## 2. L'infinitif\n\nLe verbe a une forme qui ne change pas.";

// A tutor citation is a section of the lesson's Markdown (its paragraphs,
// trimmed and joined by one blank line): found back in the reader's text.
describe("locatePassages", () => {
  it("finds a cited section, from its first paragraph to the end of its last", () => {
    const [range] = locatePassages(LESSON, ["## 1. À quoi sert le verbe ?\n\nLe verbe indique ce que fait le sujet.\n\n- **chante** est le verbe ;\n- Léa est le sujet."]);
    expect(LESSON.slice(range?.start, range?.end)).toBe("## 1. À quoi sert le verbe ?\n\nLe verbe indique ce que fait le sujet.\n\n\n- **chante** est le verbe ;\n- Léa est le sujet.");
  });

  it("several passages, in the lesson's order, overlapping ones merged; one not found is left out", () => {
    const ranges = locatePassages(LESSON, ["## 2. L'infinitif\n\nLe verbe a une forme qui ne change pas.", "absent du cours", "# Le verbe", "# Le verbe\n\n## 1. À quoi sert le verbe ?"]);
    expect(ranges.map((range) => LESSON.slice(range.start, range.end))).toEqual(["# Le verbe\n\n## 1. À quoi sert le verbe ?", "## 2. L'infinitif\n\nLe verbe a une forme qui ne change pas."]);
  });

  it("nothing to find, nothing found", () => {
    expect(locatePassages(LESSON, [])).toEqual([]);
    expect(locatePassages(LESSON, ["  "])).toEqual([]);
  });
});
