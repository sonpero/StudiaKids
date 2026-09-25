import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

// Workstations may run a newer Node than CI and production (CLAUDE.md,
// Stack): the type definitions, not the local runtime, must say which
// APIs exist, so typecheck rejects anything newer than the target.
describe("toolchain", () => {
  it("resolves @types/node to the same major version as the Node target in engines", () => {
    const root = readJson(new URL("../../../package.json", import.meta.url).pathname);
    const engines = root.engines as { node: string };
    const targetMajor = /^>=(\d+)/.exec(engines.node)?.[1];
    const typesVersion = readJson(require.resolve("@types/node/package.json")).version as string;

    expect(targetMajor).toBe("22");
    expect(typesVersion.split(".")[0]).toBe(targetMajor);
  });
});
