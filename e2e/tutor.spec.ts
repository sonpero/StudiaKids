import type { Page, Response } from "@playwright/test";
import { expect, test } from "./support/child.js";
import { confirmedCourse } from "./support/course.js";

// Acceptance (docs/jalons.md, M6, Playwright): a question on the course gets
// an answer with a visible citation and the mascot's avatar; an off-topic
// question gets a refusal carried by the mascot, with no answer streamed; a
// simulated distress question shows the out-of-band block, never a bubble.
// Plus the first-use disclosure, the daily cap and a classifier failure.
// The API replays the recorded tutor fixtures (LLM_ADAPTER=fixture): only
// the recorded questions are classified, any other one fails.
const ON_TOPIC = "c koi un verbe ?";
const OFF_TOPIC = "c'est quoi le meilleur jeu vidéo";
const DISTRESS = "mon grand frère me tape quand les parents sont pas là";
const DISCLOSURE = "Ce que tu écris ici, un grand de chez toi peut le relire, comme pour tes devoirs. Vas-y, pose ta question !";

const thread = (page: Page) => page.getByRole("log", { name: "Conversation avec le tuteur" });
const distressBlock = (page: Page) => page.getByRole("region", { name: "Besoin d'aide" });

async function openTutorFromReader(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Le verbe/ }).first().click();
  await expect(page.getByRole("heading", { name: "Le verbe", level: 1 })).toBeVisible();
  await page.getByRole("button", { name: "Poser une question" }).click();
  await expect(page.getByRole("textbox", { name: "Écris ta question…" })).toBeVisible();
}

// The SSE answer to a question, read whole: what reached the browser.
async function send(page: Page, question: string): Promise<string> {
  const answered: Promise<Response> = page.waitForResponse((res) => res.url().endsWith("/messages") && res.request().method() === "POST");
  await page.getByRole("textbox", { name: "Écris ta question…" }).fill(question);
  await page.getByRole("button", { name: "Envoyer" }).click();
  return (await answered).text();
}

test("first use from the reader: the mascot says an adult can read the exchanges, once only @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");

  await openTutorFromReader(page);

  await expect(page.getByText(DISCLOSURE)).toBeVisible();
  await expect(page.getByTestId("mascot").first()).toHaveAttribute("data-pose", "idle");
  await openTutorFromReader(page);
  await expect(page.getByText(DISCLOSURE)).toHaveCount(0);
});

test("a question on the course: an answer next to the mascot's avatar, with a citation from the lesson @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);

  await send(page, ON_TOPIC);

  const answer = thread(page).getByRole("article").filter({ hasText: "Bonne question ! Un verbe" });
  await expect(answer).toBeVisible();
  await expect(answer.getByTestId("mascot")).toHaveAttribute("data-size", "avatar");
  await expect(thread(page).getByText(ON_TOPIC)).toBeVisible();
  // docs/design/tuteur.png: a compact pill that opens the passage, highlighted, in the reader.
  await answer.getByRole("button", { name: "Dans ton cours" }).click();
  const passage = page.getByTestId("cited-passage").first();
  await expect(passage).toBeVisible();
  expect(await passage.textContent()).not.toMatch(/[*#]/);
  await expect(page.getByRole("navigation", { name: "Onglets" }).getByRole("button", { name: "Lire" })).toHaveAttribute("aria-current", "page");
});

test("an off-topic question: a refusal carried by the mascot, and no answer text ever streamed @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);

  const body = await send(page, OFF_TOPIC);

  expect(body).not.toContain("event: chunk");
  expect(body).toMatch(/^event: refusal\n/);
  await expect(thread(page).getByText("Je ne peux pas répondre à ça, je ne connais que ton cours. Pose-moi une question sur ta leçon !")).toBeVisible();
});

test("a distress question: the help block, out of the thread, with 119 and 3018 to call @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);

  const body = await send(page, DISTRESS);

  expect(body).not.toContain("event: chunk");
  const block = distressBlock(page);
  await expect(block).toBeVisible();
  await expect(block).toBeInViewport();
  await expect(block.getByRole("link", { name: /119/ })).toHaveAttribute("href", "tel:119");
  await expect(block.getByRole("link", { name: /3018/ })).toHaveAttribute("href", "tel:3018");
  await expect(thread(page).getByText("Parles-en à un adulte en qui tu as confiance", { exact: false })).toHaveCount(0);
  await expect(thread(page).getByText(DISTRESS)).toBeVisible();
});

test("a question the tutor could not read: the mascot asks to send it again", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);

  await send(page, "une question que personne n'a enregistrée");

  await expect(thread(page).getByText("Oups, je n'ai pas pu lire ta question. Tu peux la reposer ?")).toBeVisible();
});

test("past 40 questions today: the mascot says « see you tomorrow »", async ({ page, child: _child }) => {
  const courseId = await confirmedCourse(page.request, "legible");
  const opened = (await (await page.request.post(`/api/courses/${courseId}/conversations`)).json()) as { conversation: { id: string } };
  for (let i = 0; i < 40; i++) {
    expect((await page.request.post(`/api/conversations/${opened.conversation.id}/messages`, { data: { question: OFF_TOPIC } })).status()).toBe(200);
  }
  await openTutorFromReader(page);

  await send(page, ON_TOPIC);

  await expect(thread(page).getByText("Tu as posé beaucoup de questions aujourd'hui ! On continue demain ?")).toBeVisible();
});

// Decided after M6's build: the field stands clearly above the tab bar.
test("the question field stands clearly above the tab bar @mobile", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);

  const field = await page.getByRole("textbox", { name: "Écris ta question…" }).boundingBox();
  const tabs = await page.getByRole("navigation", { name: "Onglets" }).boundingBox();
  if (!field || !tabs) throw new Error("field or tab bar not laid out");
  expect(tabs.y - (field.y + field.height)).toBeGreaterThanOrEqual(32);
});

// docs/design/tuteur.png: the field and its square send button fit a
// 375px-wide phone, and nothing on the screen runs past its width.
test("at 375px wide, nothing runs past the screen, the send button included @mobile", async ({ page, child: _child }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);
  await send(page, ON_TOPIC);
  await expect(thread(page).getByRole("article").first()).toBeVisible();

  const button = await page.getByRole("button", { name: "Envoyer" }).boundingBox();
  expect((button?.x ?? 0) + (button?.width ?? 0)).toBeLessThanOrEqual(375);
  expect(await page.evaluate<number>("Math.max(...[...document.querySelectorAll('body *')].map((e) => e.getBoundingClientRect().right))")).toBeLessThanOrEqual(375);
  expect(await page.evaluate<number>("document.documentElement.scrollWidth")).toBeLessThanOrEqual(375);
});

test("the tutor opens from the home screen's last course too, and from the course's tab bar", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await page.goto("/");

  await page.getByRole("button", { name: /Poser une question/ }).click();
  await expect(page.getByRole("textbox", { name: "Écris ta question…" })).toBeVisible();
  await page.getByRole("button", { name: "Lire" }).click();
  await page.getByRole("button", { name: "Tuteur" }).click();
  await expect(page.getByRole("textbox", { name: "Écris ta question…" })).toBeVisible();
});

test("screen states: empty invites a question; an error is said by the mascot, with a way to try again", async ({ page, child: _child }) => {
  await confirmedCourse(page.request, "legible");
  await openTutorFromReader(page);
  await expect(page.getByText("Pose-moi une question sur ton cours.")).toBeVisible();

  await page.route("**/api/courses/*/conversations", (route) => route.abort());
  await page.getByRole("button", { name: "Lire" }).click();
  await page.getByRole("button", { name: "Tuteur" }).click();
  await expect(page.getByTestId("mascot").first()).toHaveAttribute("data-pose", "glitch");
  await page.unroute("**/api/courses/*/conversations");
  await page.getByRole("button", { name: "Réessaie" }).click();
  await expect(page.getByRole("textbox", { name: "Écris ta question…" })).toBeVisible();
});
