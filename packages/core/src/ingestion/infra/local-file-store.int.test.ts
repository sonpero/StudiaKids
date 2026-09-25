import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFileStore } from "./local-file-store.js";

const jpeg = (seed: number) => Uint8Array.from([0xff, 0xd8, seed, 0xff, 0xd9]);

describe("LocalFileStore", () => {
  let root: string;
  let store: LocalFileStore;
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), "studiakids-files-"));
    store = new LocalFileStore(root);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("writes photos/{userId}/{courseId}/{index}.jpg and returns that path, relative to the volume", async () => {
    const storedPath = await store.put("u1", "c1", 0, jpeg(1));

    expect(storedPath).toBe(path.join("photos", "u1", "c1", "0.jpg"));
    expect(new Uint8Array(readFileSync(path.join(root, storedPath)))).toEqual(jpeg(1));
    expect(await store.read(storedPath)).toEqual(jpeg(1));
  });

  it("deleteCourse removes the course's whole directory, and nothing else", async () => {
    const mine = await store.put("u1", "c1", 0, jpeg(1));
    await store.put("u1", "c1", 1, jpeg(2));
    const otherCourse = await store.put("u1", "c2", 0, jpeg(3));
    const otherAccount = await store.put("u2", "c1", 0, jpeg(4));

    await store.deleteCourse("u1", "c1");

    expect(existsSync(path.join(root, mine))).toBe(false);
    expect(existsSync(path.join(root, "photos", "u1", "c1"))).toBe(false);
    expect(existsSync(path.join(root, otherCourse))).toBe(true);
    expect(existsSync(path.join(root, otherAccount))).toBe(true);
  });

  it("deleteCourse on a course without any photo does not fail", async () => {
    await expect(store.deleteCourse("u1", "never-had-photos")).resolves.toBeUndefined();
  });

  it("refuses identifiers that would leave the course's own directory", async () => {
    await expect(store.put("..", "c1", 0, jpeg(1))).rejects.toThrow();
    await expect(store.put("u1", "../u2", 0, jpeg(1))).rejects.toThrow();
    await expect(store.deleteCourse("u1", "..")).rejects.toThrow();
    await expect(store.deleteCourse("", "c1")).rejects.toThrow();
  });

  it("refuses to read anything outside the photos directory, even a file that exists", async () => {
    mkdirSync(path.join(root, "db"));
    writeFileSync(path.join(root, "db", "studiakids.db"), "secret");

    await expect(store.read(path.join("photos", "..", "db", "studiakids.db"))).rejects.toThrow(/outside the photos directory/);
    await expect(store.read(path.join("db", "studiakids.db"))).rejects.toThrow(/outside the photos directory/);
    await expect(store.read("../etc/passwd")).rejects.toThrow(/outside the photos directory/);
  });
});
