import { afterEach, describe, expect, it, vi } from "vitest";
import { askTutor, getConversation, openTutor } from "./tutor.js";

afterEach(() => vi.unstubAllGlobals());

const message = { id: "m2", role: "assistant", content: "Un verbe.", citations: [{ text: "Le verbe indique…" }], issue: null, outOfBand: false, partial: false, createdAt: "2026-09-27T10:00:00.000Z" };
const conversation = { id: "k1", courseId: "c1", title: null, createdAt: "2026-09-27T10:00:00.000Z" };

function stubFetch(status: number, body?: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body === undefined ? null : JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// An SSE body cut in arbitrary places, as the network delivers it.
function stubStream(pieces: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status, headers: { "content-type": "text/event-stream" } }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
const event = (name: string, data: unknown) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;

describe("tutor API client", () => {
  it("openTutor starts or resumes the course's conversation; a course gone is null", async () => {
    const fetchMock = stubFetch(200, { conversation, showDisclosure: true });
    expect(await openTutor("c1")).toEqual({ conversation, showDisclosure: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/courses/c1/conversations", { method: "POST" });

    stubFetch(404, { error: "not_found" });
    expect(await openTutor("c1")).toBeNull();
    stubFetch(500);
    await expect(openTutor("c1")).rejects.toThrow();
  });

  it("getConversation reads the history", async () => {
    stubFetch(200, { conversation, messages: [message] });
    expect(await getConversation("k1")).toEqual({ conversation, messages: [message] });
    stubFetch(404, { error: "not_found" });
    expect(await getConversation("k1")).toBeNull();
  });

  it("askTutor hands over each chunk as it comes, then the terminal event and its message", async () => {
    const whole = event("chunk", { text: "Un " }) + event("chunk", { text: "verbe." }) + event("done", { message });
    const fetchMock = stubStream([whole.slice(0, 7), whole.slice(7, 40), whole.slice(40)]);
    const chunks: string[] = [];

    const outcome = await askTutor("k1", "c koi un verbe ?", (text) => chunks.push(text));

    expect(chunks).toEqual(["Un ", "verbe."]);
    expect(outcome).toEqual({ event: "done", message });
    expect(fetchMock).toHaveBeenCalledWith("/api/conversations/k1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: "c koi un verbe ?" }) });
  });

  it("reads every fixed outcome by its event name", async () => {
    for (const name of ["refusal", "distress", "unavailable", "daily_limit", "partial"]) {
      stubStream([event(name, { message })]);
      expect((await askTutor("k1", "?", () => undefined)).event).toBe(name);
    }
  });

  it("a stream that ends with no terminal event, or an error status, throws: never a silent end", async () => {
    stubStream([event("chunk", { text: "Un " })]);
    await expect(askTutor("k1", "?", () => undefined)).rejects.toThrow();
    stubFetch(500);
    await expect(askTutor("k1", "?", () => undefined)).rejects.toThrow();
  });
});
