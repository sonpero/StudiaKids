import { describe, expect, it } from "vitest";
import { streamSmokeReport, TUTOR_CLASSIFY_CASES, sanitizeStream } from "./tutor-recording.js";

describe("TUTOR_CLASSIFY_CASES", () => {
  it("records one question per decision, the mixed one included, all fictional", () => {
    expect(TUTOR_CLASSIFY_CASES.map((c) => c.fixtureCase)).toEqual(["classify-on-topic", "classify-off-topic", "classify-sensitive", "classify-distress", "classify-mixed"]);
    expect(TUTOR_CLASSIFY_CASES.map((c) => c.expected)).toEqual(["on_topic", "off_topic", "sensitive", "distress", "distress"]);
  });
});


describe("sanitizeStream", () => {
  it("replaces the message id, as a JSON fixture's", () => {
    expect(sanitizeStream('data: {"type":"message_start","message":{"id":"msg_01AbC","model":"m"}}')).toBe('data: {"type":"message_start","message":{"id":"msg_fixture","model":"m"}}');
  });
});

describe("streamSmokeReport", () => {
  const healthy = 'data: {"type":"message_start","message":{"id":"msg_fixture","usage":{"input_tokens":900,"output_tokens":1}}}\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":120}}';

  it("passes a streamed text answer that ended on its own", () => {
    expect(streamSmokeReport({ status: 200, latencyMs: 1, body: healthy }, "Un verbe, c'est…").ok).toBe(true);
  });

  it("fails on an HTTP error, a thinking block, a cut answer or an empty text", () => {
    expect(streamSmokeReport({ status: 529, latencyMs: 1, body: healthy }, "x").ok).toBe(false);
    expect(streamSmokeReport({ status: 200, latencyMs: 1, body: healthy.replace('"type":"text","text":""', '"type":"thinking","thinking":""') }, "x").ok).toBe(false);
    expect(streamSmokeReport({ status: 200, latencyMs: 1, body: healthy.replace("end_turn", "max_tokens") }, "x").ok).toBe(false);
    expect(streamSmokeReport({ status: 200, latencyMs: 1, body: healthy }, "  ").ok).toBe(false);
  });
});
