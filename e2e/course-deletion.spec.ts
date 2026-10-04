import type { Page } from "@playwright/test";
import { expect, test } from "./support/child.js";
import { seedCourseWithGames, TRUE_FALSE_GAMES } from "./support/games.js";

// Deleting a confirmed course (decided on 2026-10-04): from the course's
// screen, never in one tap; « Je garde mon cours » first, then deleting
// for real. Back home, the mascot says so; the stars stay.
const counter = (page: Page) => page.getByTestId("star-counter");
const tabs = (page: Page) => page.getByRole("navigation", { name: "Onglets" });

test("at 375px: delete a played course, cancel first, then confirm; the stars stay, the course is gone everywhere @mobile", async ({ page, child }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  seedCourseWithGames(child.username, "Les fractions", TRUE_FALSE_GAMES);
  seedCourseWithGames(child.username, "Le passé", [{ item: "Hier", content: { type: "true_false", statement: "Hier, c'est avant.", answer: true } }]);
  await page.goto("/");
  await page.getByRole("button", { name: /Les fractions/ }).first().click();
  await page.getByRole("button", { name: /Vrai ou faux.*Point un/ }).click();
  await page.getByRole("button", { name: "Vrai", exact: true }).click();
  await page.getByRole("button", { name: "Valider" }).click();
  await expect(counter(page)).toHaveAccessibleName("1 étoile");
  await page.getByRole("button", { name: "Tous les jeux" }).click();

  // The question, then « Je garde mon cours »: nothing is deleted.
  await tabs(page).getByRole("button", { name: "Lire" }).click();
  await page.getByRole("button", { name: "Supprimer ce cours" }).click();
  await expect(page.getByText("Le cours « Les fractions » et ses jeux vont disparaître. Tes étoiles, elles, restent !")).toBeVisible();
  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
  const keep = page.getByRole("button", { name: "Je garde mon cours" });
  const remove = page.getByRole("button", { name: "Supprimer le cours" });
  for (const target of [keep, remove]) expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate<number>("document.documentElement.scrollWidth")).toBeLessThanOrEqual(375);
  await keep.click();
  await expect(page.getByRole("button", { name: "Supprimer ce cours" })).toBeVisible();

  // Then for real.
  await page.getByRole("button", { name: "Supprimer ce cours" }).click();
  await page.getByRole("button", { name: "Supprimer le cours" }).click();

  await expect(page.getByText("C'est fait, le cours est supprimé. Tes étoiles sont toujours là !")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mes cours" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Les fractions/ })).toHaveCount(0);
  await expect(page.getByText(/Les fractions/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Le passé/ }).first()).toBeVisible();
  await expect(counter(page)).toHaveAccessibleName("1 étoile");
  // A reload shows the same: nothing of the course came back.
  await page.reload();
  await expect(page.getByRole("button", { name: /Le passé/ }).first()).toBeVisible();
  await expect(page.getByText(/Les fractions/)).toHaveCount(0);
  await expect(counter(page)).toHaveAccessibleName("1 étoile");
});
