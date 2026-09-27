import { expect, test } from "./support/child.js";
import { confirmedCourse } from "./support/course.js";

// docs/ui.md, "Navigation", drawn in docs/design/tuteur.png: the tab bar at
// the width of a small phone (375px).
test("the tab bar at 375px: four equal tabs of 44px at least, the current one a pill clear of the edges @mobile", async ({ page, child: _child }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await confirmedCourse(page.request, "legible");
  await page.goto("/");
  await page.getByRole("button", { name: /Le verbe/ }).first().click();

  const nav = page.getByRole("navigation", { name: "Onglets" });
  const tabs = nav.getByRole("button");
  await expect(tabs).toHaveCount(4);
  const boxes = await Promise.all((await tabs.all()).map((tab) => tab.boundingBox()));
  const widths = boxes.map((box) => box?.width ?? 0);
  for (const box of boxes) expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);

  const current = nav.getByRole("button", { name: "Lire" });
  await expect(current).toHaveAttribute("aria-current", "page");
  const tab = await current.boundingBox();
  const pill = await current.locator("[data-pill]").boundingBox();
  if (!tab || !pill) throw new Error("tab or pill not laid out");
  expect(pill.x - tab.x).toBeGreaterThanOrEqual(2);
  expect(tab.x + tab.width - (pill.x + pill.width)).toBeGreaterThanOrEqual(2);
  expect(pill.y - tab.y).toBeGreaterThanOrEqual(2);

  const navBox = await nav.boundingBox();
  expect((navBox?.y ?? 0) + (navBox?.height ?? 0)).toBeCloseTo(812, 0);
  expect(await page.evaluate<string>(`getComputedStyle(document.querySelector('nav[aria-label="Onglets"]')).backgroundColor`)).toBe("rgb(255, 246, 233)");
  expect(await page.evaluate<number>("document.documentElement.scrollWidth")).toBeLessThanOrEqual(375);
});

// At desktop width the tabs keep a phone's proportions, centred like the
// screens above them, the cream bar still running edge to edge.
test("the tab bar at 1280px: tabs kept in the content column, the bar edge to edge", async ({ page, child: _child }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await confirmedCourse(page.request, "legible");
  await page.goto("/");
  await page.getByRole("button", { name: /Le verbe/ }).first().click();

  const nav = await page.getByRole("navigation", { name: "Onglets" }).boundingBox();
  expect(nav?.width).toBe(1280);
  const tabs = await Promise.all((await page.getByRole("navigation", { name: "Onglets" }).getByRole("button").all()).map((tab) => tab.boundingBox()));
  const left = Math.min(...tabs.map((box) => box?.x ?? 0));
  const right = Math.max(...tabs.map((box) => (box?.x ?? 0) + (box?.width ?? 0)));
  expect(right - left).toBeLessThanOrEqual(448);
  expect(Math.abs(left + (right - left) / 2 - 640)).toBeLessThanOrEqual(1);
});
