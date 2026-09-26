import type { Page } from "@playwright/test";
import { expect, test } from "./support/child.js";
import { attemptsOf, courseWithGames, courseWithMentalMath } from "./support/games.js";

// Acceptance (docs/jalons.md, M4, Playwright): one scenario per game type,
// plus the complete flash dictation. Games made by the worker from the
// recorded fixtures (« Le verbe »); mental calculation written in base.
// Answers are given by tapping (docs/ui.md, "Jouer (M4)").

const mascot = (page: Page) => page.getByTestId("mascot");
const RIGHT = /Bravo !|Bien joué !|C'est ça !/;
const WRONG = /Pas tout à fait\. Essaie encore !|Presque ! On continue \?/;

// A card with ready games opens Jouer; then one game by its name and item.
async function openGame(page: Page, game: RegExp): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Le verbe/ }).first().click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: game }).click();
}

async function expectRight(page: Page): Promise<void> {
  await expect(page.getByText(RIGHT)).toBeVisible();
  await expect(mascot(page)).toHaveAttribute("data-pose", "joy");
  await expect(page.getByRole("button", { name: "Jeu suivant" })).toBeVisible();
}

// fixme until M4 commit 9 « web: games played by tapping » (seen failing: no Jouer screen yet).
test.fixme("Quiz: tap the right option, validate, the mascot is happy @mobile", async ({ page, child: _child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Quiz.*Le verbe « chante »/);

  await expect(page.getByText("Dans « Léa chante une chanson », quel mot est le verbe ?")).toBeVisible();
  await page.getByRole("button", { name: "chante", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
});

// fixme until M4 commit 9 « web: games played by tapping » (seen failing: no Jouer screen yet).
test.fixme("Vrai ou faux: a wrong answer gets a calm mascot, never sorry nor glitch; « Encore une fois », then right @mobile", async ({ page, child: _child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Vrai ou faux.*Définition de l'infinitif/);

  await expect(page.getByText("L'infinitif est une forme du verbe qui change tout le temps")).toBeVisible();
  await page.getByRole("button", { name: "Vrai", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByText(WRONG)).toBeVisible();
  await expect(mascot(page)).toHaveAttribute("data-pose", "waiting");

  await page.getByRole("button", { name: "Encore une fois" }).click();
  await page.getByRole("button", { name: "Faux", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expectRight(page);
});

// fixme until M4 commit 9 « web: games played by tapping » (seen failing: no Jouer screen yet).
test.fixme("Relie les paires: tap a left item then its answer, three times @mobile", async ({ page, child: _child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Relie les paires.*Chronologie des temps de Léa/);

  for (const [left, right] of [
    ["Hier", "Léa chantait"],
    ["Aujourd'hui", "Léa chante"],
    ["Demain", "Léa chantera"],
  ] as const) {
    await page.getByRole("button", { name: left, exact: true }).click();
    await page.getByRole("button", { name: right, exact: true }).click();
  }
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
});

// fixme until M4 commit 9 « web: games played by tapping » (seen failing: no Jouer screen yet).
test.fixme("Remets dans l'ordre: tap the elements in order; a second tap takes one back @mobile", async ({ page, child: _child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Remets dans l'ordre.*Chronologie des temps de Léa/);

  await page.getByRole("button", { name: "Demain, Léa chantera.", exact: true }).click();
  await page.getByRole("button", { name: /Demain, Léa chantera\./ }).click();
  for (const element of ["Hier, Léa chantait.", "Aujourd'hui, Léa chante.", "Demain, Léa chantera."]) {
    await page.getByRole("button", { name: element, exact: true }).click();
  }
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
});

// fixme until M4 commit 10 « web: typed games and the flash dictation » (seen failing: no Jouer screen yet).
test.fixme("Texte à trous: type the missing word, whatever its case @mobile", async ({ page, child: _child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Texte à trous.*Léa chantait \(hier\)/);

  await page.getByRole("textbox", { name: "Trou 1" }).fill("Chantait");
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
});

// fixme until M4 commit 10 « web: typed games and the flash dictation » (seen failing: no Jouer screen yet).
test.fixme("Calcul flash: type the result @mobile", async ({ page, child }) => {
  await courseWithMentalMath(page.request, child.username);
  await openGame(page, /Calcul flash.*Des additions à connaître/);

  await expect(page.getByText("8 + 5")).toBeVisible();
  await page.getByRole("textbox", { name: "Ta réponse" }).fill("13");
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
});

// fixme until M4 commit 10 « web: typed games and the flash dictation » (seen failing: no Jouer screen yet).
test.fixme("Dictée flash: the word, then type it from memory @mobile", async ({ page, child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Dictée flash.*Infinitif : chanter/);

  await expect(page.getByTestId("flash")).toHaveText("chanter");
  await page.getByRole("textbox", { name: "Écris le mot" }).fill("chanter");
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
  expect(attemptsOf(child.username, "delayed_copy")).toEqual([{ correct: 1, star_eligible: 1 }]);
});

// docs/modules/game-engine.md, "Copie différée": the complete journey.
// fixme until M4 commit 10 « web: typed games and the flash dictation » (seen failing: no Jouer screen yet).
test.fixme("Dictée flash, complete: timed violet flash without countdown, a field that corrects nothing, a reread without star, validation @mobile", async ({ page, child }) => {
  await courseWithGames(page.request);
  await openGame(page, /Dictée flash.*Léa chantera \(demain\)/);

  const flash = page.getByTestId("flash");
  await expect(flash).toHaveText("Léa chantera");
  await expect(flash).toHaveCSS("background-color", "rgb(58, 43, 92)");
  await expect(mascot(page)).toHaveAttribute("data-pose", "watching");
  await expect(page.getByText(/\d+ ?s\b|secondes?/)).toHaveCount(0);

  const field = page.getByRole("textbox", { name: "Écris le mot" });
  await expect(field).toBeVisible();
  await expect(flash).toHaveCount(0);
  await expect(mascot(page)).toHaveAttribute("data-pose", "waiting");
  // Accessibility criterion: checked on the attributes themselves.
  await expect(field).toHaveAttribute("autocorrect", "off");
  await expect(field).toHaveAttribute("autocapitalize", "off");
  await expect(field).toHaveAttribute("autocomplete", "off");
  await expect(field).toHaveAttribute("spellcheck", "false");

  await field.fill("Léa");
  await page.getByRole("button", { name: "Je relis le mot" }).click();
  await expect(flash).toHaveText("Léa chantera");
  await expect(field).toBeVisible();
  await expect(field).toHaveValue("Léa");
  await field.fill("Léa chantera");
  await page.getByRole("button", { name: "Valider" }).click();

  await expectRight(page);
  expect(attemptsOf(child.username, "delayed_copy")).toEqual([{ correct: 1, star_eligible: 0 }]);
});

// fixme until M4 commit 8 « web: tab bar and the Jouer screen » (seen failing: no Jouer screen yet).
test.fixme("the tab bar: Lire opens the course's text, Jouer its games, Accueil the home", async ({ page, child: _child }) => {
  await courseWithGames(page.request);
  await page.goto("/");
  await page.getByRole("button", { name: /Le verbe/ }).first().click();
  const tabs = page.getByRole("navigation", { name: "Onglets" });

  await tabs.getByRole("button", { name: "Lire" }).click();
  await expect(page.getByText("Le verbe indique ce que fait le sujet ou ce qu'il est.")).toBeVisible();
  await tabs.getByRole("button", { name: "Jouer" }).click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
  await expect(page.getByText("À toi de jouer !")).toBeVisible();
  await tabs.getByRole("button", { name: "Accueil" }).click();
  await expect(page.getByRole("heading", { name: "Mes cours" })).toBeVisible();
});
