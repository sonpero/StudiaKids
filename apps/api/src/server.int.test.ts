import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Argon2PasswordHasher, createAccount, SqliteAccountRepository, uuidV7Generator } from "@studiakids/core";
import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";

const apiDir = fileURLToPath(new URL("..", import.meta.url));
const BOUNDARY = "----studiakids-server-test";

interface Response {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

// node:http on the loopback interface, not fetch: the test setup disables
// fetch so that no test can ever reach an outside service.
function call(port: number, method: string, url: string, headers: Record<string, string>, body?: Buffer): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, method, path: url, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

function startServer(env: NodeJS.ProcessEnv): Promise<{ child: ChildProcess; port: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(apiDir, "node_modules/.bin/tsx"), ["src/server.ts"], { cwd: apiDir, env, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
      const match = /listening at http:\/\/[^:]+:(\d+)/.exec(output);
      if (match) resolve({ child, port: Number(match[1]) });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", (code) => reject(new Error(`server exited with ${String(code)} before listening:\n${output}`)));
  });
}

// The real entry point, as Railway starts it: proves server.ts hands the
// volume root to the app, so photos land in <volume>/photos/<userId>/.
describe("server.ts wiring", () => {
  let volume: string;
  let child: ChildProcess | undefined;

  beforeEach(() => {
    volume = mkdtempSync(path.join(tmpdir(), "studiakids-server-"));
  });

  afterEach(() => {
    child?.kill();
    rmSync(volume, { recursive: true, force: true });
  });

  it("stores an uploaded photo under <volume>/photos/<userId>/<courseId>/, never photos/photos/", async () => {
    mkdirSync(path.join(volume, "db"));
    const db = openDatabase(path.join(volume, "db", "studiakids.db"));
    runMigrations(db);
    const accounts = { accountRepository: new SqliteAccountRepository(db), passwordHasher: new Argon2PasswordHasher(), idGenerator: uuidV7Generator };
    await createAccount(accounts, "lea", "correct-horse", "Léa", "CM1", new Date());
    const userId = db.get<{ id: string }>(sql`SELECT id FROM accounts WHERE username = 'lea'`).id;

    const server = await startServer({
      PATH: process.env.PATH,
      RAILWAY_VOLUME_MOUNT_PATH: volume,
      PORT: "0",
      SESSION_SECRET: "test-session-secret",
    });
    child = server.child;

    const login = await call(server.port, "POST", "/api/auth/login", { "content-type": "application/json" }, Buffer.from(JSON.stringify({ username: "lea", password: "correct-horse" })));
    expect(login.status).toBe(204);
    const cookie = String(login.headers["set-cookie"]).split(";")[0]!;

    const created = await call(server.port, "POST", "/api/courses", { cookie });
    expect(created.status).toBe(201);
    const courseId = (JSON.parse(created.body) as { id: string }).id;

    const photo = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, ...Array.from({ length: 64 }, () => 1), 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 7, 0, 0xff, 0xd9]);
    const payload = Buffer.concat([
      Buffer.from(`--${BOUNDARY}\r\nContent-Disposition: form-data; name="photo"; filename="page.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      photo,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
    ]);
    const uploaded = await call(server.port, "POST", `/api/courses/${courseId}/pages`, { cookie, "content-type": `multipart/form-data; boundary=${BOUNDARY}` }, payload);
    expect(uploaded.status).toBe(201);

    expect(existsSync(path.join(volume, "photos", userId, courseId, "0.jpg"))).toBe(true);
    expect(readdirSync(path.join(volume, "photos"))).toEqual([userId]);
  }, 30_000);
});
