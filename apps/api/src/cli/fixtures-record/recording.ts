import { existsSync } from "node:fs";
import { err, ok, type Result } from "@studiakids/core";

export type RecordedExchange = { status: number; latencyMs: number; body: unknown };

export type RawExchange = { status: number; latencyMs: number; headers: Record<string, string>; bodyText: string };

// Moved to ingestion's domain (the fixture adapter matches photos on it);
// re-exported for this tool's callers.
export { jpegSize } from "@studiakids/core";

export type PhotoSize = { width: number; height: number };

// The fixture adapter tells cases apart by photo size (docs/modules/
// ingestion.md): a new photo must not take the size of another case's
// photo. Its own case's previous photo does not count (re-recording).
export function dimensionCollision(size: PhotoSize, fixtureCase: string, existing: (PhotoSize & { fixtureCase: string })[]): string | null {
  const clash = existing.find((photo) => photo.fixtureCase !== fixtureCase && photo.width === size.width && photo.height === size.height);
  return clash ? clash.fixtureCase : null;
}

// The repository is public: only the response body is kept, never a
// header (organisation id, request id...), and the message id is
// neutralised. Replay needs nothing else (content-type is implied).
export function sanitizeExchange(raw: RawExchange): RecordedExchange {
  let body: unknown = raw.bodyText;
  try {
    const parsed: unknown = JSON.parse(raw.bodyText);
    body = typeof parsed === "object" && parsed !== null && "id" in parsed ? { ...parsed, id: "msg_fixture" } : parsed;
  } catch {
    // not JSON: kept as text
  }
  return { status: raw.status, latencyMs: raw.latencyMs, body };
}

export function buildFixture(input: {
  module: string;
  fixtureCase: string;
  model: string;
  recordedAt: string;
  photo?: string;
  // The fixture whose answer was this call's input (the request body
  // itself is never written).
  source?: string;
  exchanges: RecordedExchange[];
}) {
  return {
    module: input.module,
    case: input.fixtureCase,
    model: input.model,
    recordedAt: input.recordedAt,
    ...(input.photo === undefined ? {} : { photo: input.photo }),
    ...(input.source === undefined ? {} : { source: input.source }),
    exchanges: input.exchanges,
  };
}

type ApiBody = {
  stop_reason?: string;
  content?: { type?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

const asApiBody = (body: unknown): ApiBody => (typeof body === "object" && body !== null ? body : {});

// The first recording doubles as a smoke test of the claude-sonnet-5
// adaptation (docs/modules/ingestion.md, "Client modèle"): any failed
// point stops the recording and nothing is written.
export function smokeReport(exchanges: RecordedExchange[], expectations: { adapterSucceeded: boolean; minimumInputTokens?: number }): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let healthy = expectations.adapterSucceeded && exchanges.length > 0;
  if (!expectations.adapterSucceeded) lines.push("ÉCHEC : l'adaptateur n'a pas renvoyé de résultat (voir les échanges ci-dessous).");

  exchanges.forEach((exchange, i) => {
    const body = asApiBody(exchange.body);
    const types = (body.content ?? []).map((block) => block.type);
    const thinking = types.includes("thinking") || types.includes("redacted_thinking");
    const toolUse = exchange.status === 200 && types.includes("tool_use");
    const inputTokens = body.usage?.input_tokens;
    lines.push(
      `appel ${String(i + 1)} : HTTP ${String(exchange.status)}, ${String(exchange.latencyMs)} ms, stop_reason=${body.stop_reason ?? "?"}, ` +
        `input_tokens=${String(inputTokens ?? "?")}, output_tokens=${String(body.usage?.output_tokens ?? "?")}, ` +
        `thinking=${thinking ? "OUI" : "non"}, tool_use forcé=${toolUse ? "accepté" : "REFUSÉ"}`,
    );
    if (exchange.status !== 200) {
      lines.push(`  ÉCHEC : réponse HTTP ${String(exchange.status)} : ${JSON.stringify(exchange.body)}`);
      healthy = false;
      return;
    }
    if (thinking) {
      lines.push("  ÉCHEC : bloc de thinking présent alors que la fabrique envoie thinking: disabled.");
      healthy = false;
    }
    if (!toolUse) {
      lines.push("  ÉCHEC : pas de tool_use, le tool_choice forcé n'a pas été honoré.");
      healthy = false;
    }
    if (body.stop_reason === "max_tokens") {
      lines.push("  ÉCHEC : réponse tronquée (stop_reason=max_tokens).");
      healthy = false;
    }
    if (expectations.minimumInputTokens !== undefined && (inputTokens ?? 0) < expectations.minimumInputTokens) {
      lines.push(
        `  ÉCHEC : input_tokens < ${String(expectations.minimumInputTokens)} (tokens visuels attendus au niveau haute résolution) : l'image a été réduite côté API.`,
      );
      healthy = false;
    }
  });
  return { ok: healthy, lines };
}

export function assertWritable(paths: string[], force: boolean): Result<void, string[]> {
  if (force) return ok(undefined);
  const existing = paths.filter((p) => existsSync(p));
  return existing.length === 0 ? ok(undefined) : err(existing);
}
