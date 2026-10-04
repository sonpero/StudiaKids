import { describe, expect, it } from "vitest";
import { present } from "./present.js";

// Deleting a confirmed course (decided on 2026-10-04, docs/ui.md): a calm
// question first, then a short word back home; the stars always stay.
describe("present, deleting a course", () => {
  it("the question: the calm mascot says the course and its games go, the stars stay", () => {
    const { pose, line } = present({ type: "course-delete-confirm", title: "Le verbe" }, 0);
    expect(pose).toBe("idle");
    expect(line).toBe("Le cours « Le verbe » et ses jeux vont disparaître. Tes étoiles, elles, restent !");
  });

  it("once deleted: a short word back home, never sorry nor glitch", () => {
    const { pose, line } = present({ type: "course-deleted" }, 0);
    expect(pose).toBe("idle");
    expect(line).toBe("C'est fait, le cours est supprimé. Tes étoiles sont toujours là !");
  });
});
