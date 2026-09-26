import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, photo, test } from "./support/child.js";

// Acceptance (docs/jalons.md, M2): an unusable photo → the mascot's
// message → a new try, without any course created in between.

async function photographOnce(page: Page, file: string): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Photographier un cours" }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
  await page.getByRole("button", { name: "C'est tout !" }).click();
}

async function retakeLeavesNoCourse(page: Page): Promise<void> {
  const buttons = page.getByRole("main").getByRole("button");
  await expect(buttons).toHaveCount(1);
  const chooser = page.waitForEvent("filechooser");
  await buttons.getByText("Je reprends la photo").click();
  await chooser;

  expect(await (await page.request.get("/api/courses/unconfirmed")).json()).toEqual({ course: null });
  expect(await (await page.request.get("/api/courses")).json()).toEqual({ courses: [] });
}

test("a blurred photo: the sorry mascot says so, never the model's reason, and the child retakes it", async ({ page, child: _child }) => {
  await page.goto("/");
  await photographOnce(page, photo("illegible"));

  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "sorry", { timeout: 20_000 });
  await expect(page.getByText(/un peu floue|bien lire/)).toBeVisible();
  // The model's own reason, as recorded in the fixture: never displayed.
  const recorded = JSON.parse(readFileSync(fileURLToPath(new URL("../tests/fixtures/ingestion/illegible.json", import.meta.url)), "utf8")) as {
    exchanges: { body: { content: { input: { reason: string } }[] } }[];
  };
  const reason = recorded.exchanges[0]!.body.content[0]!.input.reason;
  expect(reason.length).toBeGreaterThan(0);
  await expect(page.getByText(reason)).toHaveCount(0);
  await retakeLeavesNoCourse(page);
});

test("a photo with no lesson: same sorry mascot, its own sentence", async ({ page, child: _child }) => {
  await page.goto("/");
  await photographOnce(page, photo("not-a-course"));

  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "sorry", { timeout: 20_000 });
  await expect(page.getByText(/pas de leçon|pas une page de cours/)).toBeVisible();
  await retakeLeavesNoCourse(page);
});
