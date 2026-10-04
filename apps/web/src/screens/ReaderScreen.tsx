import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { MascotSays } from "../components/ui/MascotSays.js";
import { button } from "../components/ui/styles.js";
import { locatePassages } from "../lib/passage.js";
import { getCourseText } from "../lib/reader.js";
import { useSpeech } from "../lib/speech.js";

export interface ReaderScreenProps {
  courseId: string;
  onHome: () => void;
  // « Créer mes jeux » and its progress, under the text (docs/modules/reader.md).
  footer?: ReactNode;
  // The tutor on this course (docs/ui.md, "Tuteur (M6)").
  onAsk?: () => void;
  // Passages a tutor answer cited, highlighted (docs/design/tuteur.png).
  highlights?: string[];
  // Under the tab bar, its « Accueil » tab replaces this button.
  showHomeButton?: boolean;
  // Opens the question before deleting the course (2026-10-04).
  onDelete?: () => void;
}

const { secondary, quiet } = button;

// A fixed, generous size (18 px, docs/ui.md), no setting.
const lesson: Components = {
  h1: ({ children }) => <h1 className="font-display text-titre font-bold text-ink">{children}</h1>,
  h2: ({ children }) => <h2 className="font-display text-sous-titre font-bold text-ink">{children}</h2>,
  h3: ({ children }) => <h3 className="font-display text-corps-l font-bold text-ink">{children}</h3>,
  p: ({ children }) => <p className="font-text text-corps-l text-ink">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 font-text text-corps-l text-ink">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 font-text text-corps-l text-ink">{children}</ol>,
  // A lesson's links are never followed from here: a child stays in the app.
  a: ({ children }) => <span>{children}</span>,
};

// docs/modules/reader.md, "Écran": the lesson's text and the voice on the
// child's tap; no photo, they are gone once the course is confirmed. No
// empty state: a confirmed course always has a text.
// The lesson, with the cited passages highlighted: each part rendered as
// Markdown, so no syntax ever shows.
function Lesson({ markdown, highlights }: { markdown: string; highlights: string[] }) {
  const first = useRef<HTMLDivElement>(null);
  const ranges = locatePassages(markdown, highlights);
  useEffect(() => {
    first.current?.scrollIntoView?.({ block: "center" });
  }, [markdown]);
  const parts: ReactNode[] = [];
  let at = 0;
  ranges.forEach((range, i) => {
    if (range.start > at) parts.push(<Markdown key={`t${String(i)}`} components={lesson}>{markdown.slice(at, range.start)}</Markdown>);
    parts.push(
      <div key={`p${String(i)}`} ref={i === 0 ? first : undefined} data-testid="cited-passage" className="flex flex-col gap-3 rounded-carte border-3 border-ink bg-peche p-3">
        <Markdown components={lesson}>{markdown.slice(range.start, range.end)}</Markdown>
      </div>,
    );
    at = range.end;
  });
  if (at < markdown.length) parts.push(<Markdown key="end" components={lesson}>{markdown.slice(at)}</Markdown>);
  return <>{parts}</>;
}

export function ReaderScreen({ courseId, onHome, footer, onAsk, highlights = [], showHomeButton = true, onDelete }: ReaderScreenProps) {
  const reading = useQuery({ queryKey: ["reader", courseId], queryFn: () => getCourseText(courseId) });
  const speech = useSpeech();

  const gone = reading.data === null;
  useEffect(() => {
    if (gone) onHome();
  }, [gone, onHome]);

  let content;
  if (reading.isError) {
    content = (
      <>
        <MascotSays pose="glitch" line="Oh, quelque chose a coincé. On réessaie ?" />
        <button type="button" onClick={() => void reading.refetch()} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (!reading.data) {
    content = (
      <MascotSays pose="waiting" line="J'ouvre ton cours…" />
    );
  } else {
    const { markdown, speech: toSpeak } = reading.data;
    content = (
      <>
        {speech.supported && (
          <button
            type="button"
            onClick={() => (speech.speaking ? speech.stop() : speech.start(toSpeak))}
            className="flex min-h-11 items-center gap-2 self-end rounded-pastille border-3 border-ink bg-turquoise px-4 font-display text-corps font-bold text-ink shadow-petite"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              {speech.speaking ? <rect x="7" y="7" width="10" height="10" rx="1" /> : <path d="M4 10v4h4l5 4V6L8 10zM16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" />}
            </svg>
            {speech.speaking ? "Stop" : "Écouter"}
          </button>
        )}
        {/* The lesson on a sheet of paper: a white card. */}
        <article className="flex w-full flex-col gap-3 rounded-grande-carte border-3 border-ink bg-white p-4 text-left shadow-moyenne">
          <Lesson markdown={markdown} highlights={highlights} />
        </article>
        {onAsk && (
          <button type="button" onClick={onAsk} className="flex min-h-11 items-center gap-2 self-start rounded-pastille border-3 border-ink bg-white px-4 font-display text-corps font-bold text-ink shadow-petite">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M5 5h14v10h-9l-4 4v-4H5z" />
            </svg>
            Poser une question
          </button>
        )}
        {footer}
        {onDelete && (
          <button type="button" onClick={onDelete} className={`${quiet} mt-4`}>
            Supprimer ce cours
          </button>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 py-6 text-center">
      {content}
      {showHomeButton && (
        <button type="button" onClick={onHome} className={`${quiet} mt-auto`}>
          Accueil
        </button>
      )}
    </main>
  );
}
