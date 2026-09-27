import { expect, test } from "./support/child.js";

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
