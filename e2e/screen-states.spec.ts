import { expect, photo, test } from "./support/child.js";

// docs/ui.md, "États requis": loading, empty, error and ready for every
// screen that loads data. Ready is the photo-course journey; the others
// are forced here with page.route.

test("home, empty: the mascot invites the child to photograph a lesson, the action right there", async ({ page, child: _child }) => {
  await page.goto("/");

  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
  await expect(page.getByText(/Aucun cours pour l'instant|Prends ta leçon en photo/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Photographier un cours" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Se déconnecter" })).toBeVisible();
});

test("home, loading: the waiting mascot and a short sentence, never a bare spinner", async ({ page, child: _child }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/courses", async (route) => {
    await held;
    await route.fallback();
  });

  await page.goto("/");

  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "waiting");
  await expect(page.getByText("Je cherche tes cours…")).toBeVisible();
  release();
  await expect(page.getByRole("button", { name: "Photographier un cours" })).toBeVisible();
});

test("home, error: the glitch mascot, a child's sentence and a way to retry", async ({ page, child: _child }) => {
  let broken = true;
  await page.route("**/api/courses", (route) => (broken ? route.fulfill({ status: 500, body: "" }) : route.fallback()));

  await page.goto("/");

  // TanStack Query's default three retries (1 s, 2 s, 4 s) come first.
  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch", { timeout: 15_000 });
  await expect(page.getByText(/quelque chose a coincé/)).toBeVisible();
  await expect(page.getByText(/500|error/i)).toHaveCount(0);
  broken = false;
  await page.getByRole("button", { name: "Réessaie" }).click();
  await expect(page.getByRole("button", { name: "Photographier un cours" })).toBeVisible();
});

// Decided at M2 (docs/ui.md): a pending course replaced meanwhile answers
// 404, and the screen goes back home silently, without any message.
test("a course that answers 404 while waiting sends the child home silently", async ({ page, child: _child }) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Photographier un cours" }).click();
  await (await chooser).setFiles(photo("legible"));
  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
  await page.route(/\/api\/courses\/[^/]+$/, (route) =>
    route.request().method() === "GET" ? route.fulfill({ status: 404, json: { error: "not_found" } }) : route.fallback(),
  );
  await page.getByRole("button", { name: "C'est tout !" }).click();

  await expect(page.getByRole("button", { name: "Photographier un cours" })).toBeVisible();
  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "idle");
  await expect(page.getByText(/coincé|oups|introuvable/i)).toHaveCount(0);
});

test("course screen, error: the glitch mascot and a retry, never a raw error", async ({ page, child: _child }) => {
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Photographier un cours" }).click();
  await (await chooser).setFiles(photo("legible"));
  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
  let broken = true;
  await page.route(/\/api\/courses\/[^/]+$/, (route) =>
    route.request().method() === "GET" && broken ? route.fulfill({ status: 500, body: "" }) : route.fallback(),
  );
  await page.getByRole("button", { name: "C'est tout !" }).click();

  // TanStack Query's default three retries (1 s, 2 s, 4 s) come first.
  await expect(page.getByTestId("mascot")).toHaveAttribute("data-pose", "glitch", { timeout: 15_000 });
  await expect(page.getByText(/quelque chose a coincé/)).toBeVisible();
  broken = false;
  await page.getByRole("button", { name: "Réessaie" }).click();
  await expect(page.getByRole("heading", { name: "Le verbe" })).toBeVisible({ timeout: 20_000 });
});
