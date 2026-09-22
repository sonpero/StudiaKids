import { expect, test } from "@playwright/test";
import { TEST_FIRST_NAME } from "./support/env.js";

// Proves the storageState contract every later milestone's e2e specs will
// rely on: the default project storageState (saved once in global setup)
// is enough to start a test already authenticated, no login step needed.
test("a test using the default project storageState starts already authenticated", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText(`Salut ${TEST_FIRST_NAME} !`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).not.toBeVisible();
});
