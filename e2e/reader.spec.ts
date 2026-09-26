import type { Page } from "@playwright/test";
import { expect, test } from "./support/child.js";
import { confirmedCourse } from "./support/course.js";

// Acceptance (docs/jalons.md, M3, Playwright): the reader shows the
// course's text; reading aloud starts and stops; the generation starts
// then ends; a lesson too short says to take another photo. Recorded
// fixtures: « Le verbe » (legible) and « Le son [a] » (legible-short).

const mascot = (page: Page) => page.getByTestId("mascot");

async function openCourse(page: Page, title: RegExp): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: title }).first().click();
}

// Chromium headless often has no French voice (docs/modules/reader.md):
// the synthesis is replaced by a recorder before the page loads.
type SpeechLog = { spoken: string[]; cancelled: () => number };

async function recordSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    let cancelled = 0;
    const log: SpeechLog = { spoken, cancelled: () => cancelled };
    Object.assign(globalThis, { __speech: log });
    Object.defineProperty(globalThis, "speechSynthesis", {
      configurable: true,
      value: {
        speaking: false,
        speak: (utterance: { text: string }) => spoken.push(utterance.text),
        cancel: () => {
          cancelled++;
        },
        getVoices: () => [],
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      },
    });
  });
}
const spoken = (page: Page) => page.evaluate(() => (globalThis as unknown as { __speech: SpeechLog }).__speech.spoken);
const cancelled = (page: Page) => page.evaluate(() => (globalThis as unknown as { __speech: SpeechLog }).__speech.cancelled());

test("a course card opens the reader: the course's text and its photos @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");

  await openCourse(page, /Le verbe/);

  await expect(page.getByRole("heading", { name: "Le verbe", level: 1 })).toBeVisible();
  await expect(page.getByText("Le verbe indique ce que fait le sujet ou ce qu'il est.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Photo 1 du cours" })).toBeVisible();
  await page.getByRole("button", { name: "Agrandir la photo 1" }).click();
  await expect(page.getByRole("img", { name: "Photo 1 du cours, en grand" })).toBeVisible();
});

test("reading aloud never starts by itself, starts on « Écouter » and stops on « Stop », by keyboard too", async ({ page, child: _child }) => {
  await recordSpeech(page);
  await confirmedCourse(page.request, "legible");
  await openCourse(page, /Le verbe/);
  await expect(page.getByRole("heading", { name: "Le verbe", level: 1 })).toBeVisible();
  expect(await spoken(page)).toEqual([]);

  await page.getByRole("button", { name: "Écouter" }).click();

  const said = (await spoken(page)).join("\n");
  expect(said).toContain("Le verbe indique ce que fait le sujet");
  expect(said).not.toMatch(/#|\*\*|^- /m);
  await page.getByRole("button", { name: "Stop" }).focus();
  await page.keyboard.press("Enter");
  expect(await cancelled(page)).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "Écouter" })).toBeVisible();
});

test("« Créer mes jeux »: the mascot prepares the games, then says they are ready; the home card counts them @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openCourse(page, /Le verbe/);

  await page.getByRole("button", { name: "Créer mes jeux" }).click();

  await expect(page.getByText(/Je prépare tes jeux…|Tes jeux arrivent…|Tes jeux sont prêts !/)).toBeVisible();
  await expect(page.getByText("Tes jeux sont prêts !")).toBeVisible({ timeout: 30_000 });
  await expect(mascot(page)).toHaveAttribute("data-pose", "joy");
  await expect(page.getByRole("button", { name: "Créer mes jeux" })).toHaveCount(0);
  await page.getByRole("button", { name: "Accueil" }).click();
  await expect(page.getByRole("button", { name: /Le verbe/ })).toContainText(/\d+ jeux prêts/);
});

test("leaving while the games are being made: they keep coming, and the home card shows them later", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openCourse(page, /Le verbe/);
  await page.getByRole("button", { name: "Créer mes jeux" }).click();
  await page.getByRole("button", { name: "Accueil" }).click();

  await expect(async () => {
    await page.reload();
    await expect(page.getByRole("button", { name: /Le verbe/ })).toContainText(/\d+ jeux prêts/, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
});

test("a lesson too short: the mascot is sorry and proposes to take another photo", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible-short");
  // The fixture namer titles every course « Le verbe »; this child has only this one.
  await openCourse(page, /Le verbe/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Créer mes jeux" }).click();

  await expect(page.getByText(/pas assez à apprendre sur cette photo/)).toBeVisible({ timeout: 30_000 });
  await expect(mascot(page)).toHaveAttribute("data-pose", "sorry");
  await expect(page.getByRole("button", { name: "Prendre une autre photo" })).toBeVisible();
});

// Decided at M2: a technical failure is simulated by page.route on the
// status read, never by waiting out the jobs kernel's real backoff.
test("a technical failure of the games shows the glitch mascot, and « On réessaie » starts them again", async ({ page, child: _child }) => {
  let failed = true;
  let restarted = false;
  await page.route(/\/api\/courses\/[^/]+\/generation-status$/, async (route) => {
    const response = await route.fetch();
    if (!failed) return route.fulfill({ response });
    return route.fulfill({ response, json: { status: "failed", done: 0, total: 3, failed: 3, itemCount: 13 } });
  });
  await page.route(/\/api\/courses\/[^/]+\/generate$/, async (route) => {
    if (failed) restarted = true;
    failed = false;
    await route.fallback();
  });
  await confirmedCourse(page.request, "legible");
  await openCourse(page, /Le verbe/);

  await expect(mascot(page)).toHaveAttribute("data-pose", "glitch");
  await page.getByRole("button", { name: "On réessaie" }).click();

  expect(restarted).toBe(true);
  await expect(page.getByText("Tes jeux sont prêts !")).toBeVisible({ timeout: 30_000 });
});

test("the reader's error state: the glitch mascot and a way to try again", async ({ page, child: _child }) => {
  let broken = true;
  await page.route(/\/api\/courses\/[^/]+\/text$/, async (route) => (broken ? route.fulfill({ status: 500, body: "" }) : route.fallback()));
  await confirmedCourse(page.request, "legible");
  await openCourse(page, /Le verbe/);

  await expect(mascot(page)).toHaveAttribute("data-pose", "glitch");
  broken = false;
  await page.getByRole("button", { name: "Réessaie" }).click();
  await expect(page.getByRole("heading", { name: "Le verbe", level: 1 })).toBeVisible();
});
