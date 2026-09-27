import { QUESTION_MAX_LENGTH, type TutorMessageDto } from "@studiakids/contracts";
import { present } from "@studiakids/mascot";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState, type FormEvent } from "react";
import Markdown, { type Components } from "react-markdown";
import { Mascot, type MascotPose } from "../components/mascot/Mascot.js";
import { MascotSays } from "../components/ui/MascotSays.js";
import { ScreenHeader } from "../components/ui/ScreenHeader.js";
import { bubble, button, card, field, text } from "../components/ui/styles.js";
import { getCourse } from "../lib/courses.js";
import { subjectLabel } from "../lib/subjects.js";
import { askTutor, getConversation, openTutor } from "../lib/tutor.js";

export interface TutorScreenProps {
  courseId: string;
  onHome: () => void;
  // Opens the reader on the passages an answer cited.
  onOpenPassage?: (passages: string[]) => void;
}

// The model writes Markdown: rendered, never shown (no ** nor ## on
// screen). Headings read as bold lines; links are never followed.
const answerMarkdown: Components = {
  p: ({ children }) => <p>{children}</p>,
  h1: ({ children }) => <p className="font-bold">{children}</p>,
  h2: ({ children }) => <p className="font-bold">{children}</p>,
  h3: ({ children }) => <p className="font-bold">{children}</p>,
  h4: ({ children }) => <p className="font-bold">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
  a: ({ children }) => <span>{children}</span>,
  code: ({ children }) => <span>{children}</span>,
};

// The pose next to a stored answer (docs/modules/mascot.md): a refusal is
// the refusal pose, a failure the glitch; an answer or the cap, idle.
function poseOf(message: TutorMessageDto): MascotPose {
  if (message.issue === "off_topic" || message.issue === "sensitive") return "refusal";
  if (message.issue === "unavailable") return "glitch";
  return "idle";
}

// docs/design/tuteur.png: the child's question in turquoise, on the right.
function Question({ content }: { content: string }) {
  return (
    <p data-question className={`${bubble} max-w-[85%] self-end bg-turquoise text-left shadow-moyenne`}>
      {content}
    </p>
  );
}

// An answer or a fixed text, next to the mascot's medallion (docs/ui.md,
// "L'avatar dans le chat du tuteur").
// `generated`: the model's text, rendered from Markdown; a fixed text is
// shown as written.
function Answer({
  pose,
  content,
  generated = false,
  citations,
  partial,
  courseColor,
  onOpenPassage,
}: {
  pose: MascotPose;
  content: string;
  generated?: boolean;
  citations?: { text: string }[] | null;
  partial?: boolean;
  courseColor?: string;
  onOpenPassage?: (passages: string[]) => void;
}) {
  return (
    <article className="flex max-w-[95%] items-start gap-2 self-start text-left">
      <span className="shrink-0">
        <Mascot pose={pose} size="avatar" />
      </span>
      <div data-answer className={`${bubble} flex min-w-0 flex-col gap-2 bg-white shadow-moyenne`}>
        {generated ? <Markdown components={answerMarkdown}>{content}</Markdown> : content.split("\n").map((line, i) => <p key={i}>{line}</p>)}
        {partial && <p className={text}>Ma réponse a été coupée. Tu peux reposer ta question.</p>}
        {citations && citations.length > 0 && onOpenPassage && <PassagePill color={courseColor} onOpen={() => onOpenPassage(citations.map((citation) => citation.text))} />}
      </div>
    </article>
  );
}

// docs/design/tuteur.png: a compact pill under the answer that opens the
// cited passages, highlighted, in the reader — never the cited text here.
function PassagePill({ color, onOpen }: { color?: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={color ? { backgroundColor: `var(--${color})` } : undefined}
      className="flex min-h-11 items-center gap-2 self-start rounded-pastille border-2 border-ink bg-canvas px-3 font-text text-petit font-semibold text-ink"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
        <path d="M5 18a2 2 0 0 1 2-2h12" />
      </svg>
      Dans ton cours
    </button>
  );
}

const callButton = `${card} flex h-14 flex-1 items-center justify-center font-display text-corps-l font-bold text-ink`;

// docs/modules/tutor.md, "Rendu de l'issue distress": out of the thread,
// always in view above the field, the two public numbers callable. Its text
// is the fixed one the server stored (docs/securite.md, validated).
function HelpBlock({ content }: { content: string }) {
  return (
    <section aria-label="Besoin d'aide" className="flex flex-col gap-2 rounded-carte border-3 border-ink bg-peche p-4 text-left">
      {content.split("\n").map((line, i) => (
        <p key={i} className="font-text text-corps text-ink">
          {line}
        </p>
      ))}
      <div className="flex gap-3">
        <a href="tel:119" className={callButton}>
          Appeler le 119
        </a>
        <a href="tel:3018" className={callButton}>
          Appeler le 3018
        </a>
      </div>
    </section>
  );
}

type Pending = { question: string; answer: string; failed: boolean };

// docs/ui.md, "Tuteur (M6)": the course's last conversation (or a new
// one), the first-use disclosure, the thread, the help block, the field.
export function TutorScreen({ courseId, onHome, onOpenPassage }: TutorScreenProps) {
  const queryClient = useQueryClient();
  const fieldId = useId();
  // Opening resumes or starts the conversation: never re-sent behind the
  // child's back, or the once-only disclosure would be lost.
  const opened = useQuery({ queryKey: ["tutor", courseId], queryFn: () => openTutor(courseId), staleTime: Infinity, refetchOnWindowFocus: false, gcTime: 0 });
  const conversationId = opened.data?.conversation.id;
  const detail = useQuery({ queryKey: ["tutor-conversation", conversationId], queryFn: () => getConversation(conversationId ?? ""), enabled: conversationId !== undefined });
  // Only to name the course in the header's pill (docs/design/tuteur.png).
  const course = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [sending, setSending] = useState(false);

  const gone = opened.data === null || detail.data === null;
  useEffect(() => {
    if (gone) onHome();
  }, [gone, onHome]);

  if (opened.isError || detail.isError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-6 pb-22 text-center">
        <MascotSays pose="glitch" line="Oh, quelque chose a coincé. On réessaie ?" />
        <button type="button" onClick={() => void (opened.isError ? opened.refetch() : detail.refetch())} className={button.secondary}>
          Réessaie
        </button>
      </main>
    );
  }
  if (!opened.data || !detail.data || conversationId === undefined) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-6 pb-22 text-center">
        <MascotSays pose="waiting" line="Je prépare ton tuteur…" />
      </main>
    );
  }

  const messages = detail.data.messages;
  const distress = [...messages].reverse().find((message) => message.issue === "distress");
  const disclosure = opened.data.showDisclosure ? present({ type: "tutor-disclosure" }, 0) : null;
  const canSend = !sending && question.trim() !== "";

  async function send(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSend || conversationId === undefined) return;
    const asked = question.trim();
    setSending(true);
    setPending({ question: asked, answer: "", failed: false });
    try {
      await askTutor(conversationId, asked, (chunk) => setPending((current) => current && { ...current, answer: current.answer + chunk }));
      setQuestion("");
      await queryClient.invalidateQueries({ queryKey: ["tutor-conversation", conversationId] });
      setPending(null);
    } catch {
      setPending((current) => current && { ...current, failed: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 px-4 pt-6 text-center">
      <ScreenHeader title="Tuteur" />
      {course.data && (
        <p
          data-course-chip
          style={{ backgroundColor: `var(--${course.data.color})` }}
          className="flex items-center gap-2 self-start rounded-pastille border-2 border-ink px-3 py-1 font-text text-petit font-semibold text-ink"
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
            <path d="M5 18a2 2 0 0 1 2-2h12" />
          </svg>
          {[course.data.title, [course.data.subject ? subjectLabel(course.data.subject) : null, course.data.grade].filter((part) => part !== null).join(" ")].join(" · ")}
        </p>
      )}
      {disclosure && <MascotSays pose={disclosure.pose} line={disclosure.line} size="md" />}
      <section role="log" aria-label="Conversation avec le tuteur" className="flex flex-1 flex-col gap-3">
        {messages.length === 0 && !pending && (
          disclosure ? <p className={text}>Pose-moi une question sur ton cours.</p> : <MascotSays pose="idle" line="Pose-moi une question sur ton cours." size="md" />
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <Question key={message.id} content={message.content} />
          ) : message.outOfBand ? null : (
            <Answer
              key={message.id}
              pose={poseOf(message)}
              content={message.content}
              generated={message.issue === null}
              citations={message.citations}
              partial={message.partial}
              courseColor={course.data?.color}
              onOpenPassage={onOpenPassage}
            />
          ),
        )}
        {pending && (
          <>
            <Question content={pending.question} />
            {pending.failed ? (
              <Answer pose="glitch" content={present({ type: "tutor-unavailable" }, 0).line} />
            ) : pending.answer === "" ? (
              <Answer pose="waiting" content={present({ type: "tutor-thinking" }, 0).line} />
            ) : (
              <Answer pose="idle" content={pending.answer} generated />
            )}
          </>
        )}
      </section>
      {/* Clear of the fixed tab bar and the phone's safe area (decided after M6's build). */}
      <div className="sticky bottom-0 flex flex-col gap-3 bg-canvas pt-2 pb-[calc(--spacing(25)+env(safe-area-inset-bottom))]">
        {distress && <HelpBlock content={distress.content} />}
        <form onSubmit={(event) => void send(event)} className="flex w-full min-w-0 items-center gap-2">
          {/* docs/design/tuteur.png shows only the placeholder; the real label stays for screen readers. */}
          <label htmlFor={fieldId} className="sr-only">
            Écris ta question…
          </label>
          <input
            id={fieldId}
            value={question}
            maxLength={QUESTION_MAX_LENGTH}
            placeholder="Écris ta question…"
            onChange={(event) => setQuestion(event.target.value)}
            className={`${field} min-w-0 flex-1`}
          />
          <button
            type="submit"
            aria-label="Envoyer"
            disabled={!canSend}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-bouton border-3 border-ink bg-mandarine text-ink shadow-primaire disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M21 3 3 10l7 3 3 7z" />
              <path d="M10 13l4-4" />
            </svg>
          </button>
        </form>
      </div>
    </main>
  );
}
