import { err, exportTutorHistory, ok, SqliteAccountRepository, SqliteConversationRepository, SqliteCourseRepository, type FixedIssue, type Message, type Result } from "@studiakids/core";
import type { Db } from "./db/connection.js";

const ISSUE_LABELS: Record<FixedIssue, string> = {
  off_topic: "refus, hors sujet (message fixe)",
  sensitive: "refus, sujet sensible (message fixe)",
  distress: "⚠️ DÉTRESSE — bloc 119 / 3018 affiché (message fixe)",
  unavailable: "question non lue par le tuteur (message fixe)",
  daily_limit: "plafond du jour atteint (message fixe)",
};

const parisTime = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const when = (iso: string) => parisTime.format(new Date(iso)).replace(",", "").replace(" à ", " ");

function line(message: Message): string {
  const speaker = message.role === "user" ? "Enfant" : "Tuteur";
  const flags = [message.issue === null ? null : ISSUE_LABELS[message.issue], message.partial ? "réponse interrompue" : null].filter((flag) => flag !== null);
  const head = `[${when(message.createdAt)}] ${speaker}${flags.length > 0 ? ` [${flags.join(" ; ")}]` : ""} :`;
  const citations = message.citations && message.citations.length > 0 ? `\n    (passages du cours cités : ${String(message.citations.length)})` : "";
  return `${head} ${message.content.split("\n").join("\n    ")}${citations}`;
}

// docs/securite.md (M6): everything the account said to the tutor and got
// back, every course, distress included and flagged — for the adult who
// holds the account. CLI only, never over HTTP.
export async function tutorHistory(db: Db, username: string, options: { json: boolean }, now: Date): Promise<Result<string, "not-found">> {
  const account = await new SqliteAccountRepository(db).findByUsername(username);
  if (!account) return err("not-found");
  const courses = new SqliteCourseRepository(db);
  const entries = await exportTutorHistory({ repo: new SqliteConversationRepository(db) }, account.id);
  const withTitles = await Promise.all(entries.map(async (entry) => ({ courseTitle: (await courses.findCourse(account.id, entry.conversation.courseId))?.title ?? "(cours inconnu)", ...entry })));

  if (options.json) return ok(JSON.stringify({ username, exportedAt: now.toISOString(), conversations: withTitles }, null, 2));

  const header = [`Historique du tuteur — compte « ${username} »`, `Exporté le ${when(now.toISOString())} (heure de Paris)`, ""];
  if (withTitles.length === 0) return ok([...header, "Aucune conversation avec le tuteur."].join("\n"));
  const blocks = withTitles.map(({ courseTitle, conversation, messages }) =>
    [`== Cours « ${courseTitle} » — conversation commencée le ${when(conversation.createdAt)} ==`, ...(messages.length === 0 ? ["(aucune question)"] : messages.map(line)), ""].join("\n"),
  );
  return ok([...header, ...blocks].join("\n"));
}
