import { describe, expect, it } from "vitest";

// Non-regression: tests/support/no-network.ts was declared at the root of
// vitest.config.ts, which inline projects do not inherit, so from M0 until
// M2 no test run had the guard (CLAUDE.md, TDD). One copy per project.
describe("network guard (contract project)", () => {
  // Local discard port: if the guard is ever missing again, this test must
  // not be the thing that reaches the internet.
  it("makes any fetch() throw before it leaves the process", () => {
    expect(() => fetch("http://127.0.0.1:9/")).toThrow(/Network access is disabled in tests/);
  });

  it("clears ANTHROPIC_API_KEY, so no real key can ever leave a test", () => {
    expect(process.env.ANTHROPIC_API_KEY).toBeUndefined();
  });
});
