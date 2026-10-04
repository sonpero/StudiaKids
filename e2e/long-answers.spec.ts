import type { Page } from "@playwright/test";
import { expect, test } from "./support/child.js";
import { seedCourseWithGames } from "./support/games.js";

// Seen on a phone: a long answer ran out of its bubble. At 375px, every
// game made of bubbles gets an option with one very long word and one
// spread over three lines; no text may leave its container, and the child
// reads all of it (no smaller font, no ellipsis).
const LONG_WORD = "anticonstitutionnellement";
const THREE_LINES = "Le petit chat gris de la voisine dort tout l'après-midi sous la grande table en bois de la cuisine, pendant que la pluie tombe sur le toit";
// At 375px the word alone fits a full-width bubble: twice over, it does not,
// which is what a larger text setting on the phone does to the word alone.
const TWICE = LONG_WORD + LONG_WORD;

// Every line box of every text node in a bubble (an answer, the correction
// card, the mascot's speech), against its parent's box.
const ESCAPES = `(() => {
  const out = [];
  for (const bubble of document.querySelectorAll("main fieldset, main [role=status], main [data-bubble]")) {
  const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim();
    const parent = node.parentElement;
    if (!text || !parent || parent.closest("svg")) continue;
    const box = parent.getBoundingClientRect();
    if (box.width === 0 && box.height === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      if (line.left < box.left - 0.5 || line.right > box.right + 0.5 || line.top < box.top - 0.5 || line.bottom > box.bottom + 0.5) {
        out.push(text.slice(0, 40));
        break;
      }
    }
  }
  }
  return out;
})()`;

async function expectContained(page: Page, where: string): Promise<void> {
  await page.waitForTimeout(300);
  expect(await page.evaluate<string[]>(ESCAPES), `${where}: text out of its container`).toEqual([]);
  expect(await page.evaluate<number>("document.documentElement.scrollWidth"), `${where}: page wider than the screen`).toBeLessThanOrEqual(375);
}

// An answer is all there, on as many lines as it needs, at the size of a short one.
async function expectReadInFull(page: Page, long: string, short: string): Promise<void> {
  const measure = (text: string) =>
    page.evaluate<{ size: string; ellipsis: string; shown: string }>(`(() => {
      const el = [...document.querySelectorAll("main fieldset button")].find((e) => e.textContent.trim() === ${JSON.stringify(text)});
      const style = getComputedStyle(el);
      return { size: style.fontSize, ellipsis: style.textOverflow, shown: el.innerText };
    })()`);
  const [l, s] = [await measure(long), await measure(short)];
  expect(l.size).toBe(s.size);
  expect(l.ellipsis).not.toBe("ellipsis");
  expect(l.shown.replace(/[\s\u00ad-]/g, "")).toBe(long.replace(/[\s-]/g, ""));
}

async function lines(page: Page, text: string): Promise<number> {
  return page.evaluate<number>(`(() => {
    const walker = document.createTreeWalker(document.querySelector("main"), NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.includes(${JSON.stringify(text)})) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    }
    return 0;
  })()`);
}

async function openGame(page: Page, game: RegExp): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Les mots longs/ }).first().click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: game }).click();
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
});

test("the document is French, so that long words are hyphenated in French @mobile", async ({ page, child: _child }) => {
  await page.goto("/");
  expect(await page.evaluate<string>("document.documentElement.lang")).toBe("fr");
});

test("at 375px, a very long word and a three-line answer stay in their bubbles, in every game made of bubbles @mobile", async ({ page, child }) => {
  seedCourseWithGames(child.username, "Les mots longs", [
    { item: "Quiz long", content: { type: "mcq", question: `Quel mot est le plus long ? ${LONG_WORD}`, options: [LONG_WORD, THREE_LINES, TWICE, "chat"], answer: TWICE } },
    {
      item: "Paires longues",
      content: {
        type: "matching",
        pairs: [
          { left: LONG_WORD, right: THREE_LINES },
          { left: THREE_LINES.toUpperCase(), right: `${LONG_WORD}s` },
          { left: TWICE, right: "bref" },
        ],
      },
    },
    { item: "Ordre long", content: { type: "reordering", elements: [LONG_WORD, THREE_LINES, TWICE, "fin"] } },
    { item: "Vrai long", content: { type: "true_false", statement: `${THREE_LINES} : ${LONG_WORD}, ${TWICE}.`, answer: true } },
  ]);

  await openGame(page, /Quiz.*Quiz long/);
  expect(await lines(page, THREE_LINES)).toBeGreaterThanOrEqual(3);
  await expectContained(page, "mcq");
  await expectReadInFull(page, TWICE, "chat");
  // A wrong answer: the right one, long, is shown in its card.
  await page.getByRole("button", { name: "chat", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("status")).toContainText(TWICE);
  await expectContained(page, "mcq, correction");

  await openGame(page, /Relie les paires.*Paires longues/);
  await expectContained(page, "matching");
  await page.getByRole("button", { name: LONG_WORD, exact: true }).click();
  await page.getByRole("button", { name: THREE_LINES, exact: true }).click();
  await page.getByRole("button", { name: TWICE, exact: true }).click();
  await page.getByRole("button", { name: "bref", exact: true }).click();
  await expectContained(page, "matching, two pairs made");
  await expectReadInFull(page, LONG_WORD, "bref");

  await openGame(page, /Remets dans l'ordre.*Ordre long/);
  await expectContained(page, "reordering");
  await page.getByRole("button", { name: TWICE, exact: true }).click();
  await expectContained(page, "reordering, one placed");
  await expectReadInFull(page, THREE_LINES, "fin");

  await openGame(page, /Vrai ou faux.*Vrai long/);
  expect(await lines(page, THREE_LINES)).toBeGreaterThanOrEqual(3);
  await expectContained(page, "true_false");
});

// The mascot's bubble speaks fixed sentences; it is given a long one here
// to check its own layout.
test("at 375px, the mascot's bubble holds a very long word and three lines @mobile", async ({ page, child }) => {
  seedCourseWithGames(child.username, "Les mots longs", [{ item: "Court", content: { type: "true_false", statement: "Court.", answer: true } }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mes cours" })).toBeVisible();
  // The games held back: the mascot says it is looking for them.
  await page.route(/\/api\/courses\/[^/]+\/.+/, () => undefined);
  await page.getByRole("button", { name: /Les mots longs/ }).first().click();
  await expect(page.locator("[data-bubble]").first()).toBeVisible();
  await page.evaluate(`document.querySelector("[data-bubble]").firstChild.textContent = ${JSON.stringify(`${LONG_WORD} ${THREE_LINES} ${TWICE}`)}`);
  await expectContained(page, "mascot bubble");
});
