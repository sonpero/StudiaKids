import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Where the contract tests read model responses from. "synthetic" until
// real recordings exist (docs/jalons.md, M2: blocking for A2 and for
// closing M2); switching to recorded fixtures is this one line plus the
// file names, never a change to the tests' assertions' intent.
export const FIXTURE_SOURCE: "synthetic" | "recorded" = "synthetic";

type Fixture = { synthetic?: boolean; exchanges: { status: number; body: unknown }[] };

export function loadFixture(module: string, fixtureCase: string): Fixture {
  const dir = FIXTURE_SOURCE === "synthetic" ? `${module}/synthetic` : module;
  const file = fileURLToPath(new URL(`../fixtures/${dir}/${fixtureCase}.json`, import.meta.url));
  return JSON.parse(readFileSync(file, "utf8")) as Fixture;
}

// Serves the fixture's exchanges in order, as the Anthropic API would have,
// and records each request body. More requests than recorded exchanges is
// a test failure, never a silent extra call.
export function replayFetch(fixture: Fixture): { fetch: typeof fetch; requests: Record<string, unknown>[] } {
  const requests: Record<string, unknown>[] = [];
  const replay = (_input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    if (typeof init?.body !== "string") throw new Error("expected a JSON request body");
    requests.push(JSON.parse(init.body) as Record<string, unknown>);
    const exchange = fixture.exchanges[requests.length - 1];
    if (!exchange) throw new Error(`fixture has ${String(fixture.exchanges.length)} exchange(s), request ${String(requests.length)} has none`);
    const body = typeof exchange.body === "string" ? exchange.body : JSON.stringify(exchange.body);
    return Promise.resolve(new Response(body, { status: exchange.status, headers: { "content-type": "application/json" } }));
  };
  return { fetch: replay, requests };
}
