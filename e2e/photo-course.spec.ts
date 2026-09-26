import type { Page } from "@playwright/test";
import { CHILD_GRADE, expect, photo, test } from "./support/child.js";

// Acceptance (docs/jalons.md, M2): full journey photo → confirmation →
// course listed on the home screen. Synthetic fixtures (decided at M2):
// replayed on the recorded ones before M2 closes.

const mascot = (page: Page) => page.getByTestId("mascot");

async function takePhoto(page: Page, button: string, file: string): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button }).click();
  await (await chooser).setFiles(file);
}

async function photographLesson(page: Page, files: string[]): Promise<void> {
  await takePhoto(page, "Photographier un cours", files[0]!);
  for (const [i, file] of files.slice(1).entries()) {
    await expect(page.getByRole("img", { name: `Page ${String(i + 1)}` })).toBeVisible();
    await takePhoto(page, "Une autre page", file);
  }
  await expect(page.getByRole("img", { name: `Page ${String(files.length)}` })).toBeVisible();
  await page.getByRole("button", { name: "C'est tout !" }).click();
}

test("three photos become one course: waiting, confirmation, then listed under Mes cours @mobile", async ({ page, child: _child }) => {
  await page.goto("/");
  await photographLesson(page, [photo("legible"), photo("legible.2"), photo("legible.3")]);

  await expect(mascot(page)).toHaveAttribute("data-pose", "waiting");
  await expect(page.getByText(/Je regarde ta photo…|Je lis ta leçon…/)).toBeVisible();

  await expect(page.getByRole("heading", { name: "Le verbe" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Français")).toBeVisible();
  await expect(page.getByText(CHILD_GRADE)).toBeVisible();
  await expect(page.getByRole("img", { name: "Ta photo" })).toBeVisible();
  await page.getByRole("button", { name: "Oui, c'est ça !" }).click();

  await expect(page.getByRole("heading", { name: "Mes cours" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Le verbe/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ta photo est prête|Je regarde encore/ })).toHaveCount(0);
});

test("leaving during the reading: the home banner brings the child back to the ready course", async ({ page, child: _child }) => {
  await page.goto("/");
  await photographLesson(page, [photo("legible")]);
  await page.getByRole("button", { name: "Retour à l'accueil" }).click();

  const banner = page.getByRole("button", { name: /Ta photo est prête !/ });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await banner.click();

  await expect(page.getByRole("heading", { name: "Le verbe" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Oui, c'est ça !" })).toBeVisible();
});

// Decided at M2: a technical failure is simulated by page.route on the
// status read, never by waiting out the jobs kernel's real backoff.
test("a technical failure shows the glitch mascot, and « On réessaie » relaunches the reading", async ({ page, child: _child }) => {
  let failed = true;
  let retried = false;
  await page.route(/\/api\/courses\/[^/]+$/, async (route) => {
    const response = await route.fetch();
    if (route.request().method() !== "GET" || !failed) return route.fulfill({ response });
    return route.fulfill({ response, json: { ...((await response.json()) as Record<string, unknown>), extractionStatus: "failed" } });
  });
  await page.route(/\/api\/courses\/[^/]+\/retry$/, async (route) => {
    retried = true;
    failed = false;
    await route.fulfill({ status: 202, body: "" });
  });

  await page.goto("/");
  await photographLesson(page, [photo("legible")]);

  await expect(mascot(page)).toHaveAttribute("data-pose", "glitch");
  await expect(page.getByText(/quelque chose a coincé|Ça n'a pas marché/)).toBeVisible();
  await page.getByRole("button", { name: "On réessaie" }).click();

  expect(retried).toBe(true);
  await expect(page.getByRole("heading", { name: "Le verbe" })).toBeVisible({ timeout: 20_000 });
});

// docs/ui.md, "Accueil": photos taken, then the app closed before
// « C'est tout ! ». The banner resumes the capture, never a waiting screen
// with nothing running.
test("photos left before « C'est tout ! »: the banner resumes the capture, then the reading runs", async ({ page, child: _child }) => {
  await page.goto("/");
  await takePhoto(page, "Photographier un cours", photo("legible"));
  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Tu n'as pas fini tes photos. On continue ?" }).click();

  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
  await page.getByRole("button", { name: "C'est tout !" }).click();
  await expect(page.getByRole("heading", { name: "Le verbe" })).toBeVisible({ timeout: 20_000 });
});
