import { afterEach, describe, expect, it, vi } from "vitest";
import { answerExercise, gameLabel, listPlayableExercises } from "./play.js";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("play API client", () => {
  it("listPlayableExercises reads the course's games and the next one", async () => {
    const list = { exercises: [{ id: "e1", itemTitle: "Le verbe", type: "true_false", statement: "Vrai." }], nextExerciseId: "e1" };
    const fetchMock = stubFetch(200, list);

    expect(await listPlayableExercises("c1")).toEqual(list);
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1/exercises");
  });

  it("a deleted course (404) is null; any other failure throws", async () => {
    stubFetch(404, { error: "not_found" });
    expect(await listPlayableExercises("c1")).toBeNull();
    stubFetch(500);
    await expect(listPlayableExercises("c1")).rejects.toThrow();
  });

  it("answerExercise posts the answer and the reread flag, and returns the units", async () => {
    const fetchMock = stubFetch(200, { result: { units: [{ id: "0", correct: true }] } });

    expect(await answerExercise("e1", { value: true }, false)).toEqual({ units: [{ id: "0", correct: true }] });
    expect(fetchMock).toHaveBeenCalledWith("/api/exercises/e1/answer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ givenAnswer: { value: true }, reread: false }),
    });
    stubFetch(400, { error: "invalid_answer" });
    await expect(answerExercise("e1", {}, false)).rejects.toThrow();
  });

  it("names each game for the child (docs/ui.md, « à valider » except Dictée flash)", () => {
    expect(["mcq", "true_false", "matching", "reordering", "cloze", "mental_math", "delayed_copy"].map((type) => gameLabel(type as "mcq"))).toEqual([
      "Quiz",
      "Vrai ou faux",
      "Relie les paires",
      "Remets dans l'ordre",
      "Texte à trous",
      "Calcul flash",
      "Dictée flash",
    ]);
  });

  it("answerExercise returns the correction a wrong answer brings back", async () => {
    stubFetch(200, { result: { units: [{ id: "0", correct: false }] }, correction: { chosenOption: "chante" } });

    expect(await answerExercise("e1", { chosenOption: "Léa" }, false)).toEqual({ units: [{ id: "0", correct: false }], correction: { chosenOption: "chante" } });
  });
});
