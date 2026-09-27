import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { Mascot } from "../components/mascot/Mascot.js";
import { pageFileUrl } from "../lib/courses.js";
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
}

const text = "font-text text-corps text-ink-soft";
const secondary =
  "h-14 rounded-bouton border-3 border-ink bg-turquoise px-6 font-display text-corps-l font-bold text-ink shadow-moyenne";
const quiet = "h-11 px-4 font-text text-corps text-ink-soft underline";

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

// docs/modules/reader.md, "Écran": the lesson's text, its photos, the voice
// on the child's tap. No empty state: a confirmed course always has a text.
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

export function ReaderScreen({ courseId, onHome, footer, onAsk, highlights = [], showHomeButton = true }: ReaderScreenProps) {
  const reading = useQuery({ queryKey: ["reader", courseId], queryFn: () => getCourseText(courseId) });
  const speech = useSpeech();
  const [enlarged, setEnlarged] = useState<number | null>(null);

  const gone = reading.data === null;
  useEffect(() => {
    if (gone) onHome();
  }, [gone, onHome]);

  let content;
  if (reading.isError) {
    content = (
      <>
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button type="button" onClick={() => void reading.refetch()} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (!reading.data) {
    content = (
      <>
        <Mascot pose="waiting" />
        <p className={text}>J'ouvre ton cours…</p>
      </>
    );
  } else {
    const { markdown, speech: toSpeak, photos } = reading.data;
    content = (
      <>
        {speech.supported && (
          <button type="button" onClick={() => (speech.speaking ? speech.stop() : speech.start(toSpeak))} className={`${secondary} self-end`}>
            {speech.speaking ? "Stop" : "Écouter"}
          </button>
        )}
        <article className="flex w-full flex-col gap-3 text-left">
          <Lesson markdown={markdown} highlights={highlights} />
        </article>
        <ul className="flex w-full flex-wrap gap-3">
          {photos.map(({ index }) => (
            <li key={index}>
              <button type="button" aria-label={`Agrandir la photo ${String(index + 1)}`} onClick={() => setEnlarged(index)} className="min-h-11 min-w-11">
                <img
                  src={pageFileUrl(courseId, index)}
                  alt={`Photo ${String(index + 1)} du cours`}
                  className="h-24 w-auto rounded-bouton border-3 border-ink object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
        {onAsk && (
          <button type="button" onClick={onAsk} className={secondary}>
            Poser une question
          </button>
        )}
        {footer}
        {enlarged !== null && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-canvas p-4">
            <img
              src={pageFileUrl(courseId, enlarged)}
              alt={`Photo ${String(enlarged + 1)} du cours, en grand`}
              className="max-h-[80dvh] w-auto rounded-carte border-3 border-ink object-contain"
            />
            <button type="button" onClick={() => setEnlarged(null)} className={secondary}>
              Fermer
            </button>
          </div>
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
