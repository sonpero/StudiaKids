import type { Page } from "@playwright/test";
import { expect, test } from "./support/child.js";
import { confirmedCourse } from "./support/course.js";
import { seedCourseWithGames } from "./support/games.js";

// docs/ui.md, "Direction visuelle": both fonts actually loaded, and the
// mascot drawn in its reference colours through the tokens.
test("Baloo 2 and Lexend are loaded; the mascot keeps its colours @mobile", async ({ page, child: _child }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Salut/ })).toBeVisible();
  await page.evaluate("document.fonts.ready");

  expect(await page.evaluate<boolean>(`document.fonts.check('700 27px "Baloo 2"')`)).toBe(true);
  expect(await page.evaluate<boolean>(`document.fonts.check('400 16px "Lexend"')`)).toBe(true);
  expect(await page.evaluate<string[]>(`[...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, ""))`)).toEqual(
    expect.arrayContaining(["Baloo 2", "Lexend"]),
  );

  expect(await page.evaluate<string[]>(`(() => { const e = document.querySelectorAll('[data-testid="mascot"] ellipse')[3]; return [getComputedStyle(e).fill, getComputedStyle(e).stroke]; })()`)).toEqual(["rgb(255, 198, 66)", "rgb(43, 33, 64)"]);
});

// T6 of the design session: at 375px, no element runs past the screen and
// no Markdown syntax is ever visible, on every main screen.
async function sound(page: Page, where: string): Promise<void> {
  await page.waitForTimeout(300);
  const overflow = await page.evaluate<string[]>(`[...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 375.5 || e.getBoundingClientRect().left < -0.5).map((e) => e.tagName + '.' + (e.getAttribute('class') ?? '').slice(0, 40))`);
  expect(overflow, `${where}: elements past the screen`).toEqual([]);
  expect(await page.evaluate<number>("document.documentElement.scrollWidth"), where).toBeLessThanOrEqual(375);
  const visible = await page.evaluate<string>("document.body.innerText");
  expect(visible, `${where}: Markdown shown`).not.toMatch(/\*\*|##/);
}

test("every main screen at 375px: nothing past the screen, no ** nor ## visible @mobile", async ({ page, child }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Photographier un cours" })).toBeVisible();
  await sound(page, "home, empty");

  await confirmedCourse(page.request, "legible");
  seedCourseWithGames(child.username, "Les fractions", [
    { item: "Le verbe « chante »", content: { type: "mcq", question: "Quel mot est le verbe ?", options: ["Léa", "chante", "une", "chanson"], answer: "chante" } },
    { item: "Infinitif", content: { type: "delayed_copy", wordOrPhrase: "chandail" } },
  ]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mes cours" })).toBeVisible();
  await sound(page, "home");

  await page.getByRole("button", { name: /Le verbe/ }).first().click();
  await expect(page.getByRole("button", { name: "Créer mes jeux" })).toBeVisible();
  await sound(page, "reader");

  await page.getByRole("button", { name: "Poser une question" }).click();
  await page.getByRole("textbox", { name: "Écris ta question…" }).fill("c koi un verbe ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByRole("button", { name: "Dans ton cours" })).toBeVisible();
  await sound(page, "tutor, answer");

  await page.goto("/");
  await page.getByRole("button", { name: /Les fractions/ }).first().click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
  await sound(page, "games");
  await page.getByRole("button", { name: /Quiz/ }).click();
  await sound(page, "a game");
  await page.getByRole("button", { name: "chante", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("button", { name: "Jeu suivant" })).toBeVisible();
  await sound(page, "bravo");
  await page.getByRole("button", { name: "Jeu suivant" }).click();
  await expect(page.getByTestId("flash")).toBeVisible();
  await sound(page, "flash");
  await expect(page.getByRole("textbox", { name: "Écris le mot" })).toBeVisible({ timeout: 10_000 });
  await sound(page, "typing");
  await page.getByRole("textbox", { name: "Écris le mot" }).fill("chandail");
  await page.getByRole("button", { name: "Valider" }).click();
  await page.getByRole("button", { name: "Jeu suivant" }).click();
  await expect(page.getByText(/Bravo, tu as gagné/)).toBeVisible();
  await sound(page, "summary");
});

