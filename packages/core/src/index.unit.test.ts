import { describe, expect, it } from "vitest";
import { CORE_PACKAGE } from "./index.js";

describe("@studiakids/core", () => {
  it("exposes its package name, proving the package builds and Vitest picks it up", () => {
    expect(CORE_PACKAGE).toBe("@studiakids/core");
  });
});
