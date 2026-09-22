import { expect, test } from "@playwright/test";
import { TEST_FIRST_NAME, TEST_PASSWORD, TEST_USERNAME } from "./support/env.js";

// Every other e2e spec reuses the authenticated storageState saved by
// global setup. This one must not: it is the dedicated test for the login
// flow itself (docs/modules/auth.md), so it starts from a blank session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("login", () => {
  test("full login and logout cycle", async ({ page }) => {
    await page.goto("/");

    const loginButton = page.getByRole("button", { name: "Se connecter" });
    await expect(loginButton).toBeVisible();

    await page.getByLabel("Identifiant").fill(TEST_USERNAME);
    await page.getByLabel("Mot de passe").fill(TEST_PASSWORD);
    await loginButton.click();

    await expect(page.getByText(`Salut ${TEST_FIRST_NAME} !`)).toBeVisible();

    await page.getByRole("button", { name: "Se déconnecter" }).click();

    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("visiting the app while unauthenticated never shows protected content, only the login screen", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByText(`Salut ${TEST_FIRST_NAME} !`)).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Se déconnecter" })).not.toBeVisible();
  });

  test("a wrong password shows a plain error and does not log in", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Identifiant").fill(TEST_USERNAME);
    await page.getByLabel("Mot de passe").fill("not-the-password");
    await page.getByRole("button", { name: "Se connecter" }).click();

    await expect(page.getByRole("alert")).toHaveText("Identifiant ou mot de passe incorrect.");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  });

  test("the session survives a page reload", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Identifiant").fill(TEST_USERNAME);
    await page.getByLabel("Mot de passe").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(`Salut ${TEST_FIRST_NAME} !`)).toBeVisible();

    await page.reload();

    await expect(page.getByText(`Salut ${TEST_FIRST_NAME} !`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Se connecter" })).not.toBeVisible();
  });

  test("the session survives closing the tab and opening a new one", async ({ context, page }) => {
    await page.goto("/");
    await page.getByLabel("Identifiant").fill(TEST_USERNAME);
    await page.getByLabel("Mot de passe").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page.getByText(`Salut ${TEST_FIRST_NAME} !`)).toBeVisible();

    await page.close();
    const newPage = await context.newPage();
    await newPage.goto("/");

    await expect(newPage.getByText(`Salut ${TEST_FIRST_NAME} !`)).toBeVisible();
  });
});
