import type { Page } from "@playwright/test";
import { CHILD_PASSWORD, expect, test } from "./support/child.js";
import { seedCourseWithGames, TRUE_FALSE_GAMES } from "./support/games.js";

// Acceptance (docs/jalons.md, M5, Playwright): a streak of right answers
// sets off the joy dance; after logging in again, the home offers to
// resume the right course. Plus: the counter climbs live, a wrong answer
// takes nothing away, the session summary shows only gains.

const mascot = (page: Page) => page.getByTestId("mascot");
const counter = (page: Page) => page.getByTestId("star-counter");

async function openCourse(page: Page, title: string): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: new RegExp(title) }).first().click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
}

// Plays one true-or-false game of the list and comes back to it.
async function play(page: Page, item: string, answer: "Vrai" | "Faux", back = true): Promise<void> {
  await page.getByRole("button", { name: new RegExp(`Vrai ou faux.*${item}`) }).click();
  await page.getByRole("button", { name: answer, exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(page.getByRole("button", { name: "Jeu suivant" })).toBeVisible();
  if (back) await page.getByRole("button", { name: "Tous les jeux" }).click();
}

test("five right answers in a row: the counter climbs live, the fifth brings the bonus and the joy dance @mobile", async ({ page, child }) => {
  seedCourseWithGames(child.username, "Les fractions", TRUE_FALSE_GAMES);
  await openCourse(page, "Les fractions");

  for (const [i, item] of ["Point un", "Point deux", "Point trois", "Point quatre"].entries()) {
    await play(page, item, "Vrai", false);
    await expect(counter(page)).toHaveAccessibleName(`${String(i + 1)} étoile${i === 0 ? "" : "s"}`);
    await expect(mascot(page)).not.toHaveAttribute("data-motion", "dance");
    await page.getByRole("button", { name: "Tous les jeux" }).click();
  }
  await play(page, "Point cinq", "Vrai", false);

  await expect(page.getByText(/Super série !|Quelle série, bravo !/)).toBeVisible();
  await expect(mascot(page)).toHaveAttribute("data-pose", "joy");
  await expect(mascot(page)).toHaveAttribute("data-motion", "dance");
  await expect(mascot(page)).toHaveCSS("animation-name", "mascot-dance");
  await expect(counter(page)).toHaveAccessibleName("6 étoiles");
  await page.getByRole("button", { name: "Tous les jeux" }).click();
  await page.getByRole("navigation", { name: "Onglets" }).getByRole("button", { name: "Accueil" }).click();
  await expect(counter(page)).toHaveAccessibleName("6 étoiles");
});

test("a wrong answer takes nothing away; the first success after it is celebrated @mobile", async ({ page, child }) => {
  seedCourseWithGames(child.username, "Les fractions", TRUE_FALSE_GAMES);
  await openCourse(page, "Les fractions");
  await play(page, "Point un", "Vrai");

  await play(page, "Point six", "Vrai", false);
  await expect(mascot(page)).toHaveAttribute("data-pose", "waiting");
  await expect(counter(page)).toHaveAccessibleName("1 étoile");
  await expect(page.getByText(/-\s?\d|perdu/)).toHaveCount(0);

  await page.getByRole("button", { name: "Encore une fois" }).click();
  await page.getByRole("button", { name: "Faux", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(mascot(page)).toHaveAttribute("data-motion", "dance");
  await expect(counter(page)).toHaveAccessibleName("2 étoiles");
});

test("with reduced motion, the mascot takes the joy pose without moving", async ({ page, child }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  seedCourseWithGames(child.username, "Les fractions", TRUE_FALSE_GAMES);
  await openCourse(page, "Les fractions");
  await play(page, "Point six", "Vrai");
  await play(page, "Point six", "Faux", false);

  await expect(mascot(page)).toHaveAttribute("data-pose", "joy");
  await expect(mascot(page)).toHaveAttribute("data-motion", "dance");
  await expect(mascot(page)).toHaveCSS("animation-name", "none");
});

test("the session summary shows only what was won, never a mistake @mobile", async ({ page, child }) => {
  seedCourseWithGames(child.username, "Les fractions", TRUE_FALSE_GAMES);
  await openCourse(page, "Les fractions");
  await play(page, "Point un", "Vrai");
  await play(page, "Point six", "Vrai");
  await play(page, "Point deux", "Vrai");

  await page.getByRole("button", { name: "J'ai fini" }).click();

  await expect(page.getByText("Bravo, tu as gagné 2 étoiles !")).toBeVisible();
  await expect(page.getByText("2 bonnes réponses")).toBeVisible();
  await expect(mascot(page)).toHaveAttribute("data-pose", "joy");
  await expect(page.getByText(/erreur|faux|raté|manqué/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Encore des jeux" }).click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
});

test("after logging in again, the home offers to resume the last course opened @mobile", async ({ page, child }) => {
  seedCourseWithGames(child.username, "Les fractions", TRUE_FALSE_GAMES);
  seedCourseWithGames(child.username, "Le passé composé", [{ item: "Avoir ou être", content: { type: "true_false", statement: "On dit « j'ai chanté ».", answer: true } }]);
  await openCourse(page, "Les fractions");
  await page.goto("/");
  await openCourse(page, "Le passé composé");

  await page.getByRole("navigation", { name: "Onglets" }).getByRole("button", { name: "Accueil" }).click();
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await page.getByLabel("Identifiant").fill(child.username);
  await page.getByLabel("Mot de passe").fill(CHILD_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();

  const resume = page.getByRole("button", { name: /Le passé composé.*On reprend \?/ });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page.getByRole("heading", { name: "Tes jeux", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Avoir ou être/ })).toBeVisible();
});
