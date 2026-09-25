import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { assertWritable, buildFixture, jpegSize, sanitizeExchange, smokeReport, type RecordedExchange } from "./recording.js";

const segment = (marker: number, payload: number[]) => [0xff, marker, (payload.length + 2) >> 8, (payload.length + 2) & 0xff, ...payload];

describe("jpegSize", () => {
  it("reads width and height from the frame header, past any other segment", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, ...segment(0xe1, [1, 2, 3]), ...segment(0xc0, [8, 0x06, 0x7b, 0x08, 0xa4, 3]), 0xff, 0xd9]);

    expect(jpegSize(jpeg)).toEqual({ width: 2212, height: 1659 });
  });

  it("reads progressive JPEGs too (SOF2)", () => {
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, ...segment(0xc2, [8, 0, 10, 0, 20, 3])]))).toEqual({ width: 20, height: 10 });
  });

  it("returns null when there is no frame header", () => {
    expect(jpegSize(Uint8Array.from([0xff, 0xd8, ...segment(0xdb, [0])]))).toBeNull();
  });
});

const apiBody = {
  id: "msg_01ABCdefREALid",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5",
  content: [{ type: "tool_use", id: "toolu_01", name: "json", input: { markdown: "# A", legible: true, isCoursePage: true } }],
  stop_reason: "tool_use",
  usage: { input_tokens: 4900, output_tokens: 120 },
};

describe("sanitizeExchange", () => {
  it("keeps the raw response body but never any header, and neutralises the message id", () => {
    const exchange = sanitizeExchange({
      status: 200,
      latencyMs: 1234,
      headers: { "anthropic-organization-id": "org-secret", "request-id": "req_secret", "content-type": "application/json" },
      bodyText: JSON.stringify(apiBody),
    });

    expect(exchange).toEqual({ status: 200, latencyMs: 1234, body: { ...apiBody, id: "msg_fixture" } });
    const serialized = JSON.stringify(exchange);
    expect(serialized).not.toContain("org-secret");
    expect(serialized).not.toContain("req_secret");
    expect(serialized).not.toContain("msg_01ABCdefREALid");
  });

  it("keeps a non-JSON body as text, still without headers", () => {
    expect(sanitizeExchange({ status: 529, latencyMs: 5, headers: { "request-id": "req_x" }, bodyText: "Overloaded" })).toEqual({
      status: 529,
      latencyMs: 5,
      body: "Overloaded",
    });
  });
});

describe("buildFixture", () => {
  it("writes the case, model, date, photo and exchanges, and nothing else", () => {
    const exchanges: RecordedExchange[] = [{ status: 200, latencyMs: 10, body: apiBody }];

    expect(buildFixture({ module: "ingestion", fixtureCase: "legible", model: "claude-sonnet-5", recordedAt: "2026-09-25T10:00:00.000Z", photo: "photos/legible.jpg", exchanges })).toEqual({
      module: "ingestion",
      case: "legible",
      model: "claude-sonnet-5",
      recordedAt: "2026-09-25T10:00:00.000Z",
      photo: "photos/legible.jpg",
      exchanges,
    });
  });
});

describe("smokeReport", () => {
  const exchange = (body: Record<string, unknown>, status = 200): RecordedExchange => ({ status, latencyMs: 2345, body });

  it("passes a clean answer and prints latency, stop_reason, tokens, thinking and tool use", () => {
    const report = smokeReport([exchange(apiBody)], { adapterSucceeded: true, minimumInputTokens: 4740 });

    expect(report.ok).toBe(true);
    expect(report.lines.join("\n")).toMatch(/2345 ms.*stop_reason=tool_use.*input_tokens=4900.*output_tokens=120.*thinking=non.*tool_use forcé=accepté/s);
  });

  it("fails on truncation (stop_reason max_tokens)", () => {
    expect(smokeReport([exchange({ ...apiBody, stop_reason: "max_tokens" })], { adapterSucceeded: true }).ok).toBe(false);
  });

  it("fails when a thinking block came back although thinking is disabled", () => {
    const body = { ...apiBody, content: [{ type: "thinking", thinking: "" }, ...apiBody.content] };

    expect(smokeReport([exchange(body)], { adapterSucceeded: true }).ok).toBe(false);
  });

  it("fails when the forced tool call was refused (no tool_use, or an HTTP error)", () => {
    expect(smokeReport([exchange({ ...apiBody, content: [{ type: "text", text: "hi" }], stop_reason: "end_turn" })], { adapterSucceeded: true }).ok).toBe(false);
    expect(smokeReport([exchange({ type: "error", error: { type: "invalid_request_error" } }, 400)], { adapterSucceeded: false }).ok).toBe(false);
  });

  it("fails when the image cost fewer tokens than the high-resolution tier implies (downscaled by the API)", () => {
    const report = smokeReport([exchange({ ...apiBody, usage: { input_tokens: 1700, output_tokens: 120 } })], { adapterSucceeded: true, minimumInputTokens: 4740 });

    expect(report.ok).toBe(false);
    expect(report.lines.join("\n")).toContain("4740");
  });

  it("fails when the adapter itself did not return a result, even with clean exchanges", () => {
    expect(smokeReport([exchange(apiBody)], { adapterSucceeded: false }).ok).toBe(false);
  });
});

describe("assertWritable", () => {
  let dir: string;
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("refuses to overwrite an existing fixture unless forced", () => {
    dir = mkdtempSync(path.join(tmpdir(), "fixtures-"));
    const existing = path.join(dir, "legible.json");
    writeFileSync(existing, "{}");

    expect(assertWritable([existing, path.join(dir, "new.jpg")], false)).toEqual({ ok: false, error: [existing] });
    expect(assertWritable([existing], true)).toEqual({ ok: true, value: undefined });
    expect(assertWritable([path.join(dir, "new.jpg")], false)).toEqual({ ok: true, value: undefined });
  });
});
