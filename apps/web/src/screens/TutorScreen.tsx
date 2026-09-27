import { QUESTION_MAX_LENGTH, type TutorMessageDto } from "@studiakids/contracts";
import { present } from "@studiakids/mascot";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Mascot, type MascotPose } from "../components/mascot/Mascot.js";
import { askTutor, getConversation, openTutor } from "../lib/tutor.js";

export interface TutorScreenProps {
  courseId: string;
  onHome: () => void;
  // Opens the reader on the passages an answer cited.
  onOpenPassage?: (passages: string[]) => void;
}

const text = "font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)]";
const secondary =
  "h-[56px] rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_4px_0_var(--color-ink)]";
const bubble = "rounded-[20px] border-[3px] border-[var(--color-ink)] px-4 py-3 font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]";

// The pose next to a stored answer (docs/modules/mascot.md): a refusal is
// the refusal pose, a failure the glitch; an answer or the cap, idle.
function poseOf(message: TutorMessageDto): MascotPose {
  if (message.issue === "off_topic" || message.issue === "sensitive") return "refusal";
  if (message.issue === "unavailable") return "glitch";
  return "idle";
}

function Question({ content }: { content: string }) {
  return <p className={`${bubble} max-w-[85%] self-end bg-[var(--color-soleil)] text-left`}>{content}</p>;
}

// An answer or a fixed text, next to the mascot's medallion (docs/ui.md,
// "L'avatar dans le chat du tuteur").
function Answer({ pose, content, citations, partial, onOpenPassage }: { pose: MascotPose; content: string; citations?: { text: string }[] | null; partial?: boolean; onOpenPassage?: (passages: string[]) => void }) {
  return (
    <article className="flex max-w-[95%] items-start gap-2 self-start text-left">
      <span className="shrink-0 rounded-[999px] border-[3px] border-[var(--color-ink)] bg-white p-1">
        <Mascot pose={pose} size="avatar" />
      </span>
      <div className={`${bubble} flex flex-col gap-2 bg-white`}>
        {content.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
        {partial && <p className={text}>Ma réponse a été coupée. Tu peux reposer ta question.</p>}
        {citations && citations.length > 0 && onOpenPassage && <PassagePill onOpen={() => onOpenPassage(citations.map((citation) => citation.text))} />}
      </div>
    </article>
  );
}

// docs/design/tuteur.png: a compact pill under the answer that opens the
// cited passages, highlighted, in the reader — never the cited text here.
function PassagePill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[44px] items-center gap-2 self-start rounded-[999px] border-[2px] border-[var(--color-ink)] bg-[var(--color-canvas)] px-3 font-[family-name:var(--font-text)] text-[14.5px] font-semibold text-[var(--color-ink)]"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
        <path d="M5 18a2 2 0 0 1 2-2h12" />
      </svg>
      Dans ton cours
    </button>
  );
}

// docs/modules/tutor.md, "Rendu de l'issue distress": out of the thread,
// always in view above the field, the two public numbers callable. Its text
// is the fixed one the server stored (docs/securite.md, validated).
function HelpBlock({ content }: { content: string }) {
  return (
    <section aria-label="Besoin d'aide" className="flex flex-col gap-2 rounded-[20px] border-[3px] border-[var(--color-ink)] bg-[var(--color-peche)] p-4 text-left">
      {content.split("\n").map((line, i) => (
        <p key={i} className="font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink)]">
          {line}
        </p>
      ))}
      <div className="flex gap-3">
        <a href="tel:119" className={`${secondary} flex flex-1 items-center justify-center bg-white`}>
          Appeler le 119
        </a>
        <a href="tel:3018" className={`${secondary} flex flex-1 items-center justify-center bg-white`}>
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
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [sending, setSending] = useState(false);

  const gone = opened.data === null || detail.data === null;
  useEffect(() => {
    if (gone) onHome();
  }, [gone, onHome]);

  if (opened.isError || detail.isError) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-6 pb-[88px] text-center">
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button type="button" onClick={() => void (opened.isError ? opened.refetch() : detail.refetch())} className={secondary}>
          Réessaie
        </button>
      </main>
    );
  }
  if (!opened.data || !detail.data || conversationId === undefined) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-6 pb-[88px] text-center">
        <Mascot pose="waiting" />
        <p className={text}>Je prépare ton tuteur…</p>
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
      <h1 className="font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">Tuteur</h1>
      {disclosure && (
        <div className="flex flex-col items-center gap-2">
          <Mascot pose={disclosure.pose} />
          <p className={text}>{disclosure.line}</p>
        </div>
      )}
      <section role="log" aria-label="Conversation avec le tuteur" className="flex flex-1 flex-col gap-3">
        {messages.length === 0 && !pending && (
          <div className="flex flex-col items-center gap-2">
            {!disclosure && <Mascot pose="idle" />}
            <p className={text}>Pose-moi une question sur ton cours.</p>
          </div>
        )}
        {messages.map((message) =>
          message.role === "user" ? (
            <Question key={message.id} content={message.content} />
          ) : message.outOfBand ? null : (
            <Answer key={message.id} pose={poseOf(message)} content={message.content} citations={message.citations} partial={message.partial} onOpenPassage={onOpenPassage} />
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
              <Answer pose="idle" content={pending.answer} />
            )}
          </>
        )}
      </section>
      {/* Clear of the fixed tab bar and the phone's safe area (decided after M6's build). */}
      <div className="sticky bottom-0 flex flex-col gap-3 bg-[var(--color-canvas)] pt-2 pb-[calc(100px+env(safe-area-inset-bottom))]">
        {distress && <HelpBlock content={distress.content} />}
        <form onSubmit={(event) => void send(event)} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1 text-left">
            <label htmlFor={fieldId} className="font-[family-name:var(--font-display)] text-[16px] font-bold text-[var(--color-ink)]">
              Écris ta question…
            </label>
            <input
              id={fieldId}
              value={question}
              maxLength={QUESTION_MAX_LENGTH}
              onChange={(event) => setQuestion(event.target.value)}
              className="h-[56px] rounded-[15px] border-[3px] border-[var(--color-ink)] bg-white px-3 font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]"
            />
          </div>
          <button type="submit" disabled={!canSend} className={`${secondary} disabled:opacity-50`}>
            Envoyer
          </button>
        </form>
      </div>
    </main>
  );
}
