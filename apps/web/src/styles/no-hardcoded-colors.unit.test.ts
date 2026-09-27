import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("..", import.meta.url));

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? files(full) : [full];
  });
}

// docs/ui.md: colours come from tokens.css only. Tests are left out: some
// pin the tokens' own values against docs/design/tokens.md.
const checked = files(src).filter((file) => /\.(tsx?|css)$/.test(file) && !/\.test\.tsx?$/.test(file) && !file.endsWith(path.join("styles", "tokens.css")));
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\(/g;

describe("colours", () => {
  it("the guard reads the source it protects", () => {
    expect(checked.some((file) => file.endsWith(path.join("mascot", "Idle.tsx")))).toBe(true);
    expect(checked.some((file) => file.endsWith("TutorScreen.tsx"))).toBe(true);
  });

  it("no hexadecimal, rgb or hsl colour outside tokens.css", () => {
    const found = checked.flatMap((file) => [...readFileSync(file, "utf8").matchAll(COLOUR)].map((match) => `${path.relative(src, file)}: ${match[0]}`));
    expect(found).toEqual([]);
  });
});
