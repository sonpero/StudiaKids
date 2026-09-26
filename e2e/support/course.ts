import { readFileSync } from "node:fs";
import { expect, type APIRequestContext } from "@playwright/test";
import { photo } from "./child.js";

// A course the child has photographed and confirmed, prepared over the API
// (the photo journey itself has its own scenarios): the worker reads the
// recorded fixture's photo, then the course is confirmed.
export async function confirmedCourse(request: APIRequestContext, fixturePhoto: string): Promise<string> {
  const id = ((await (await request.post("/api/courses")).json()) as { id: string }).id;
  const upload = await request.post(`/api/courses/${id}/pages`, {
    multipart: { photo: { name: "page.jpg", mimeType: "image/jpeg", buffer: readFileSync(photo(fixturePhoto)) } },
  });
  expect(upload.status()).toBe(201);
  expect((await request.post(`/api/courses/${id}/extract`)).status()).toBe(202);
  await expect
    .poll(async () => ((await (await request.get(`/api/courses/${id}`)).json()) as { extractionStatus: string }).extractionStatus, { timeout: 20_000 })
    .toBe("ready");
  expect((await request.post(`/api/courses/${id}/confirm`)).status()).toBe(204);
  return id;
}
