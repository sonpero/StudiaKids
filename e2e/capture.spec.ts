import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { jpegSize } from "@studiakids/core";
// By path: the repository root does not depend on @studiakids/contracts,
// and a test is no reason to add one.
import { nativePhotoSize } from "../packages/contracts/src/photo-size.js";
import { cameraPhoto, expect, photo, test } from "./support/child.js";
import { hasApp1Segment } from "./support/multipart.js";

async function takePhoto(page: Page, button: string, file: string): Promise<void> {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button }).click();
  await (await chooser).setFiles(file);
}

// Acceptance (docs/jalons.md, M2): the « Une autre page » button is gone
// at the fifth page, « C'est tout ! » stays.
test("« Une autre page » disappears at the fifth page @mobile", async ({ page, child: _child }) => {
  await page.goto("/");
  const pages = ["legible", "legible.2", "legible.3", "illegible", "not-a-course"].map(photo);

  await takePhoto(page, "Photographier un cours", pages[0]!);
  for (const [i, file] of pages.slice(1).entries()) {
    await expect(page.getByRole("img", { name: `Page ${String(i + 1)}` })).toBeVisible();
    await takePhoto(page, "Une autre page", file);
  }

  await expect(page.getByRole("img", { name: "Page 5" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Une autre page" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "C'est tout !" })).toBeVisible();
});

// docs/modules/ingestion.md, "Tests clés": what leaves the capture screen
// is always the canvas re-encoding, never the camera file — upright
// (EXIF orientation applied), at nativePhotoSize, without any EXIF/GPS.
// Playwright does not expose a multipart body holding a Blob
// (postDataBuffer() is undefined), so the photo is read where the page
// hands it to fetch: the FormData's "photo" part, byte for byte what the
// upload request carries.
test("the uploaded photo is the canvas re-encoding: upright, at native size, without EXIF or GPS @mobile", async ({ page, child: _child }) => {
  // A string: this file is type-checked without the DOM library.
  await page.addInitScript({
    content: `
      window.__sentPhotos = [];
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const part = init && init.body instanceof FormData ? init.body.get("photo") : null;
        if (part instanceof Blob) window.__sentPhotos.push(Array.from(new Uint8Array(await part.arrayBuffer())));
        return original(input, init);
      };
    `,
  });
  await page.goto("/");
  const upload = page.waitForRequest((request) => request.method() === "POST" && /\/api\/courses\/[^/]+\/pages$/.test(request.url()));

  await takePhoto(page, "Photographier un cours", cameraPhoto);

  await upload;
  const sent = new Uint8Array(await page.evaluate<number[]>("window.__sentPhotos[0] ?? []"));
  // The camera file is 4032x3024 with EXIF orientation 6: displayed as a
  // 3024x4032 portrait.
  expect(jpegSize(sent)).toEqual(nativePhotoSize(3024, 4032));
  expect(hasApp1Segment(sent)).toBe(false);
  expect(Buffer.from(sent).equals(readFileSync(cameraPhoto))).toBe(false);
  await expect(page.getByRole("img", { name: "Page 1" })).toBeVisible();
});

// docs/ui.md, "Photographier un cours": the capture input takes photos
// from the camera on a phone or a tablet.
test("the photo input asks for an image from the camera", async ({ page, child: _child }) => {
  await page.goto("/");

  const input = page.locator('input[type="file"]');
  await expect(input).toHaveAttribute("accept", "image/*");
  await expect(input).toHaveAttribute("capture", /.*/);
});
