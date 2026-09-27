import { describe, expect, it } from "vitest";
import { DISTRESS_TEXT, fixedText } from "./fixed-texts.js";

// docs/securite.md: every text the tutor shows without a model is fixed.
describe("fixed texts", () => {
  it("the distress text relays the two public numbers, gives no advice, asks nothing", () => {
    expect(DISTRESS_TEXT).toContain("119");
    expect(DISTRESS_TEXT).toContain("3018");
    expect(DISTRESS_TEXT).toMatch(/adulte en qui tu as confiance/);
    expect(DISTRESS_TEXT).not.toMatch(/\?/);
    expect(fixedText("distress")).toBe(DISTRESS_TEXT);
  });

  it("the sensitive refusal is securite.md's exact text, with no invitation", () => {
    expect(fixedText("sensitive")).toBe("Je ne peux pas répondre à ça, je ne connais que ton cours.");
  });

  it("the off-topic refusal invites back to the lesson, the others say what to do", () => {
    expect(fixedText("off_topic")).toBe("Je ne peux pas répondre à ça, je ne connais que ton cours. Pose-moi une question sur ta leçon !");
    expect(fixedText("unavailable")).toMatch(/reposer/);
    expect(fixedText("daily_limit")).toMatch(/On continue demain \?/);
  });
});
