import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { Mascot } from "../components/mascot/Mascot.js";
import { pageFileUrl } from "../lib/courses.js";
import { getCourseText } from "../lib/reader.js";
import { useSpeech } from "../lib/speech.js";

export interface ReaderScreenProps {
  courseId: string;
  onHome: () => void;
  // « Créer mes jeux » and its progress, under the text (docs/modules/reader.md).
  footer?: ReactNode;
  // Under the tab bar, its « Accueil » tab replaces this button.
  showHomeButton?: boolean;
}

const text = "font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)]";
const secondary =
  "h-[56px] rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_4px_0_var(--color-ink)]";
const quiet = "h-[44px] px-4 font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)] underline";

// A fixed, generous size (18 px, docs/ui.md), no setting.
const lesson: Components = {
  h1: ({ children }) => <h1 className="font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">{children}</h1>,
  h2: ({ children }) => <h2 className="font-[family-name:var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">{children}</h2>,
  h3: ({ children }) => <h3 className="font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)]">{children}</h3>,
  p: ({ children }) => <p className="font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-6 font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]">{children}</ol>,
  // A lesson's links are never followed from here: a child stays in the app.
  a: ({ children }) => <span>{children}</span>,
};

// docs/modules/reader.md, "Écran": the lesson's text, its photos, the voice
// on the child's tap. No empty state: a confirmed course always has a text.
export function ReaderScreen({ courseId, onHome, footer, showHomeButton = true }: ReaderScreenProps) {
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
          <Markdown components={lesson}>{markdown}</Markdown>
        </article>
        <ul className="flex w-full flex-wrap gap-3">
          {photos.map(({ index }) => (
            <li key={index}>
              <button type="button" aria-label={`Agrandir la photo ${String(index + 1)}`} onClick={() => setEnlarged(index)} className="min-h-[44px] min-w-[44px]">
                <img
                  src={pageFileUrl(courseId, index)}
                  alt={`Photo ${String(index + 1)} du cours`}
                  className="h-[96px] w-auto rounded-[15px] border-[3px] border-[var(--color-ink)] object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
        {footer}
        {enlarged !== null && (
          <div role="dialog" aria-modal="true" className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-[var(--color-canvas)] p-4">
            <img
              src={pageFileUrl(courseId, enlarged)}
              alt={`Photo ${String(enlarged + 1)} du cours, en grand`}
              className="max-h-[80dvh] w-auto rounded-[20px] border-[3px] border-[var(--color-ink)] object-contain"
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
