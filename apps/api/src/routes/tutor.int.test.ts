import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Argon2PasswordHasher, createAccount, DISTRESS_TEXT, fixedText, SqliteAccountRepository, TUTOR_DAILY_LIMIT, uuidV7Generator } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { openDatabase, type Db } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { selectTutorModels } from "../tutor-models.js";

const PASSWORD = "correct-horse";
const LONG_AGO = "2026-01-01T00:00:00.000Z";

// The text the tutor fixtures were recorded on (ingestion/legible.json).
const fixturesRoot = fileURLToPath(new URL("../../../../tests/fixtures", import.meta.url));
const legible = JSON.parse(readFileSync(path.join(fixturesRoot, "ingestion/legible.json"), "utf8")) as { exchanges: { body: { content: { type: string; input?: { markdown: string } }[] } }[] };
const LESSON = legible.exchanges.at(-1)?.body.content.find((block) => block.type === "tool_use")?.input?.markdown ?? "";

type Opened = { conversation: { id: string }; showDisclosure: boolean };
type SseEvent = { event: string; data: unknown };
function parseSse(payload: string): SseEvent[] {
  return payload
    .split("\n\n")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const line = (prefix: string) => block.split("\n").find((l) => l.startsWith(prefix))?.slice(prefix.length);
      return { event: line("event: ") ?? "", data: JSON.parse(line("data: ") ?? "null") as unknown };
    });
}

// docs/modules/tutor.md, API and Tests clés; docs/jalons.md, M6.
describe("tutor routes", () => {
  let volume: string;
  let db: Db;
  let app: ReturnType<typeof buildApp>;
  let lea: string;
  let tom: string;

  async function login(username: string): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password: PASSWORD } });
    const raw = res.headers["set-cookie"];
    const match = /^([^=]+)=([^;]+)/.exec(Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? ""));
    if (!match) throw new Error("no session cookie");
    return `${match[1]}=${match[2]}`;
  }

  function seedCourse(username: string, ready = true): string {
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = ${username}`).id;
    const id = uuidV7Generator.next();
    db.run(sql`INSERT INTO courses (id, user_id, title, subject, grade, color, extraction_status, confirmed, created_at, last_accessed_at)
               VALUES (${id}, ${userId}, 'Le verbe', 'french', 'CE2', 'matiere-francais', ${ready ? "ready" : "running"}, ${ready ? 1 : 0}, ${LONG_AGO}, ${LONG_AGO})`);
    if (ready) db.run(sql`INSERT INTO extractions (course_id, markdown, extracted_at) VALUES (${id}, ${LESSON}, ${LONG_AGO})`);
    return id;
  }

  const open = (cookie: string, courseId: string) => app.inject({ method: "POST", url: `/api/courses/${courseId}/conversations`, headers: { cookie } });
  async function conversationOf(cookie: string, courseId: string): Promise<string> {
    return open(cookie, courseId).then((res) => res.json<Opened>().conversation.id);
  }
  const askQuestion = (cookie: string, conversationId: string, question: string) => app.inject({ method: "POST", url: `/api/conversations/${conversationId}/messages`, headers: { cookie }, payload: { question } });

  beforeEach(async () => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-api-tutor-"));
    const dbPath = path.join(volume, "test.db");
    db = openDatabase(dbPath);
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", PASSWORD, "Léa", "CE2", new Date());
    await createAccount(accounts, "tom", PASSWORD, "Tom", "CE2", new Date());
    app = buildApp({ databasePath: dbPath, dataDir: volume, sessionSecret: "test-session-secret", cookieSecure: false, tutorModels: selectTutorModels({ LLM_ADAPTER: "fixture" }) });
    lea = await login("lea");
    tom = await login("tom");
  });

  afterEach(async () => {
    await app.close();
    rmSync(volume, { recursive: true, force: true });
  });

  it("a question on the course: the answer streamed, then done with its message and citations", async () => {
    const conversation = await conversationOf(lea, seedCourse("lea"));

    const res = await askQuestion(lea, conversation, "c koi un verbe ?");

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    const events = parseSse(res.body);
    const chunks = events.filter((e) => e.event === "chunk");
    expect(chunks.length).toBeGreaterThan(1);
    expect(events.at(-1)?.event).toBe("done");
    const message = (events.at(-1)?.data as { message: { content: string; citations: { text: string }[]; issue: null } }).message;
    expect(message.content).toBe(chunks.map((c) => (c.data as { text: string }).text).join(""));
    expect(message.citations.length).toBeGreaterThan(0);
    expect(events.filter((e) => e.event !== "chunk")).toHaveLength(1);
  });

  it("off topic, sensitive: one refusal event, no text streamed", async () => {
    const conversation = await conversationOf(lea, seedCourse("lea"));
    for (const [question, reason] of [
      ["c'est quoi le meilleur jeu vidéo", "off_topic"],
      ["comment on fabrique une bombe", "sensitive"],
    ] as const) {
      const events = parseSse((await askQuestion(lea, conversation, question)).body);
      expect(events).toEqual([{ event: "refusal", data: { message: expect.objectContaining({ issue: reason, content: fixedText(reason), outOfBand: false }) as unknown } }]);
    }
  });

  it("distress: one distress event, out of band, kept in the history the adult can read", async () => {
    const conversation = await conversationOf(lea, seedCourse("lea"));

    const events = parseSse((await askQuestion(lea, conversation, "mon grand frère me tape quand les parents sont pas là")).body);

    expect(events).toEqual([{ event: "distress", data: { message: expect.objectContaining({ issue: "distress", content: DISTRESS_TEXT, outOfBand: true }) as unknown } }]);
    const history = (await app.inject({ method: "GET", url: `/api/conversations/${conversation}`, headers: { cookie: lea } })).json<{ messages: { role: string; issue: string | null; outOfBand: boolean }[] }>();
    expect(history.messages.map((m) => [m.role, m.issue, m.outOfBand])).toEqual([
      ["user", null, false],
      ["assistant", "distress", true],
    ]);
  });

  it("a question the classifier cannot read: the fixed « ask again » message, exchange kept", async () => {
    const conversation = await conversationOf(lea, seedCourse("lea"));

    const events = parseSse((await askQuestion(lea, conversation, "une question jamais enregistrée")).body);

    expect(events).toEqual([{ event: "unavailable", data: { message: expect.objectContaining({ issue: "unavailable", content: fixedText("unavailable") }) as unknown } }]);
  });

  it("past the daily cap: « tomorrow », but distress still gets through", async () => {
    const conversation = await conversationOf(lea, seedCourse("lea"));
    for (let i = 0; i < TUTOR_DAILY_LIMIT; i++) await askQuestion(lea, conversation, "c'est quoi le meilleur jeu vidéo");

    expect(parseSse((await askQuestion(lea, conversation, "c koi un verbe ?")).body).map((e) => e.event)).toEqual(["daily_limit"]);
    expect(parseSse((await askQuestion(lea, conversation, "mon grand frère me tape quand les parents sont pas là")).body).map((e) => e.event)).toEqual(["distress"]);
  });

  it("refuses an empty or too long question", async () => {
    const conversation = await conversationOf(lea, seedCourse("lea"));
    expect((await askQuestion(lea, conversation, "   ")).statusCode).toBe(400);
    expect((await askQuestion(lea, conversation, "a".repeat(501))).statusCode).toBe(400);
  });

  it("opening resumes the course's conversation; the disclosure shows once per account, even after deleting it", async () => {
    const course = seedCourse("lea");
    const first = (await open(lea, course)).json<Opened>();
    expect(first.showDisclosure).toBe(true);
    expect((await open(lea, course)).json()).toMatchObject({ conversation: { id: first.conversation.id }, showDisclosure: false });

    expect((await app.inject({ method: "DELETE", url: `/api/conversations/${first.conversation.id}`, headers: { cookie: lea } })).statusCode).toBe(204);
    const again = (await open(lea, course)).json<Opened>();

    expect(again.conversation.id).not.toBe(first.conversation.id);
    expect(again.showDisclosure).toBe(false);
    expect((await open(tom, seedCourse("tom"))).json<Opened>().showDisclosure).toBe(true);
  });

  it("lists the course's conversations, titled by their first question", async () => {
    const course = seedCourse("lea");
    const conversation = await conversationOf(lea, course);
    await askQuestion(lea, conversation, "c koi un verbe ?");

    const res = await app.inject({ method: "GET", url: `/api/courses/${course}/conversations`, headers: { cookie: lea } });

    expect(res.json()).toEqual({ conversations: [expect.objectContaining({ id: conversation, courseId: course, title: "c koi un verbe ?" }) as unknown] });
  });

  // docs/securite.md: another account's conversation is a 404 identical to
  // an unknown id, on every route.
  it("another account's conversation or course is exactly an unknown one", async () => {
    const course = seedCourse("lea");
    const conversation = await conversationOf(lea, course);
    await askQuestion(lea, conversation, "c koi un verbe ?");
    const unknown = uuidV7Generator.next();

    const pairs = [
      [{ method: "GET", url: `/api/conversations/${conversation}` }, { method: "GET", url: `/api/conversations/${unknown}` }],
      [{ method: "DELETE", url: `/api/conversations/${conversation}` }, { method: "DELETE", url: `/api/conversations/${unknown}` }],
      [{ method: "POST", url: `/api/conversations/${conversation}/messages`, payload: { question: "c koi un verbe ?" } }, { method: "POST", url: `/api/conversations/${unknown}/messages`, payload: { question: "c koi un verbe ?" } }],
      [{ method: "POST", url: `/api/courses/${course}/conversations` }, { method: "POST", url: `/api/courses/${unknown}/conversations` }],
      [{ method: "GET", url: `/api/courses/${course}/conversations` }, { method: "GET", url: `/api/courses/${unknown}/conversations` }],
    ] as const;
    for (const [theirs, missing] of pairs) {
      const a = await app.inject({ ...theirs, headers: { cookie: tom } });
      const b = await app.inject({ ...missing, headers: { cookie: tom } });
      expect([a.statusCode, a.body], theirs.url).toEqual([404, b.body]);
      expect(b.statusCode).toBe(404);
    }
    expect(db.get<{ n: number }>(sql`SELECT count(*) AS n FROM messages`).n).toBe(2);
    expect(db.get<{ n: number }>(sql`SELECT count(*) AS n FROM conversations`).n).toBe(1);
  });

  it("a course not read yet cannot be talked about", async () => {
    const res = await open(lea, seedCourse("lea", false));
    expect(res.statusCode).toBe(409);
    expect(res.json()).toEqual({ error: "not_ready" });
  });

  it("requires a session", async () => {
    expect((await app.inject({ method: "POST", url: `/api/courses/${seedCourse("lea")}/conversations` })).statusCode).toBe(401);
  });
});
