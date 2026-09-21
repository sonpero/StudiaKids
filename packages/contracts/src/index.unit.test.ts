import { describe, expect, it } from "vitest";
import { CONTRACTS_PACKAGE } from "./index.js";

describe("@studiakids/contracts", () => {
  it("exposes its package name, proving the package builds and Vitest picks it up", () => {
    expect(CONTRACTS_PACKAGE).toBe("@studiakids/contracts");
  });
});
