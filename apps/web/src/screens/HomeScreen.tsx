import { present } from "@studiakids/mascot";
import type { CourseDto, ExtractionStatus } from "@studiakids/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { PhotoPicker } from "../components/PhotoPicker.js";
import { StarCounter } from "../components/StarCounter.js";
import { getUnconfirmedCourse, listCourses, pollInterval } from "../lib/courses.js";
import { subjectLabel } from "../lib/subjects.js";

export const COURSES_QUERY_KEY = ["courses"];
export const UNCONFIRMED_QUERY_KEY = ["courses", "unconfirmed"];

// docs/ui.md, "Accueil": one sentence per state of the pending course.
const BANNER: Record<ExtractionStatus, string> = {
  pending: "Je regarde encore ta photo…",
  running: "Je regarde encore ta photo…",
  ready: "Ta photo est prête !",
  illegible: "Oups, on reprend la photo ?",
  not_a_course_page: "Oups, on reprend la photo ?",
  failed: "Oh, quelque chose a coincé.",
};
// Photos taken, reading never launched: back to the capture (à valider).
const NOT_LAUNCHED = "Tu n'as pas fini tes photos. On continue ?";

export interface HomeScreenProps {
  firstName: string;
  onPhoto: (file: File) => void;
  onLogout: () => void;
  onOpenCourse?: (courseId: string) => void;
  // A confirmed course, from its card: Jouer when its games are ready,
  // otherwise the reader (docs/ui.md, "Jouer (M4)").
  onReadCourse?: (courseId: string) => void;
  onPlayCourse?: (courseId: string) => void;
  onResumeCapture?: (course: CourseDto) => void;
}

const text = "font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)]";

// docs/ui.md, "Photographier un cours (M2)" and "États requis": loading,
// error, empty and ready, each with the mascot and a sentence.
export function HomeScreen({ firstName, onPhoto, onLogout, onOpenCourse, onReadCourse, onPlayCourse, onResumeCapture }: HomeScreenProps) {
  const courses = useQuery({ queryKey: COURSES_QUERY_KEY, queryFn: listCourses });
  const [openedAt] = useState(() => Date.now());
  const unconfirmed = useQuery({
    queryKey: UNCONFIRMED_QUERY_KEY,
    // Read at call time: a failure only hides the banner, never the home.
    queryFn: () => getUnconfirmedCourse(),
    refetchInterval: (query) => (query.state.data ? pollInterval(query.state.data.extractionStatus, Date.now() - openedAt) : false),
  });
  // A course with no page yet has nothing to come back to.
  const pending = unconfirmed.data && unconfirmed.data.pageCount > 0 ? unconfirmed.data : null;
  // Which of the catalogue's lines to say; the choice is the caller's
  // (docs/modules/mascot.md, "variantIndex").
  const [variant] = useState(() => Math.floor(Math.random() * 2));

  // Jouer when the course's games are ready, otherwise Lire.
  const openConfirmed = (course: { id: string; exerciseCount: number }) => (course.exerciseCount > 0 ? onPlayCourse?.(course.id) : onReadCourse?.(course.id));

  let body;
  if (courses.isPending) {
    body = (
      <>
        <Mascot pose="waiting" />
        <p className={text}>Je cherche tes cours…</p>
      </>
    );
  } else if (courses.isError) {
    body = (
      <>
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button
          type="button"
          onClick={() => void courses.refetch()}
          className="h-[56px] rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_4px_0_var(--color-ink)]"
        >
          Réessaie
        </button>
      </>
    );
  } else {
    const list = courses.data;
    // docs/ui.md, M5: the last course opened (read or played), kept by
    // the server, so it is still offered after logging in again.
    const lastOpened = list.reduce<(typeof list)[number] | null>((last, course) => (last === null || course.lastAccessedAt > last.lastAccessedAt ? course : last), null);
    const { pose, line } = present({ type: "home", hasExistingCourses: list.length > 0 }, variant);
    body = (
      <>
        <Mascot pose={pose} />
        <p className={text}>{line}</p>
        <PhotoPicker label="Photographier un cours" variant="primary" onPhoto={onPhoto} />
        {pending && (
          <button
            type="button"
            onClick={() => (pending.extractionStarted === false ? onResumeCapture?.(pending) : onOpenCourse?.(pending.id))}
            className="min-h-[56px] w-full rounded-[20px] border-[3px] border-[var(--color-ink)] bg-[var(--color-soleil)] px-4 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_4px_0_var(--color-ink)]"
          >
            {pending.extractionStarted === false ? NOT_LAUNCHED : BANNER[pending.extractionStatus]}
          </button>
        )}
        {list.length > 0 && (
          <section className="flex w-full flex-col gap-3 text-left">
            <h2 className="font-[family-name:var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">Mes cours</h2>
            <ul className="flex flex-col gap-3">
              {list.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => openConfirmed(course)}
                    className="flex min-h-[56px] w-full items-center gap-3 rounded-[20px] border-[3px] border-[var(--color-ink)] bg-white p-3 text-left shadow-[0_4px_0_var(--color-ink)]"
                  >
                    <span
                      data-subject-chip
                      style={{ backgroundColor: `var(--${course.color})` }}
                      className="h-[44px] w-[44px] shrink-0 rounded-[15px] border-[2px] border-[var(--color-ink)]"
                    />
                    <span className="flex flex-col">
                      <span className="font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)]">{course.title}</span>
                      <span className="text-[14.5px] text-[var(--color-ink-soft)]">
                        {course.subject ? subjectLabel(course.subject) : ""} · {course.grade}
                      </span>
                      {course.id === lastOpened?.id && (
                        <span className="self-start rounded-[999px] border-[2px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-2 text-[14.5px] font-bold text-[var(--color-ink)]">
                          On reprend ?
                        </span>
                      )}
                      {course.exerciseCount > 0 && (
                        <span className="text-[14.5px] font-bold text-[var(--color-ink)]">
                          {course.exerciseCount === 1 ? "1 jeu prêt" : `${String(course.exerciseCount)} jeux prêts`}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 py-6 text-center">
      <header className="flex w-full items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">Salut {firstName} !</h1>
        <StarCounter />
      </header>
      {body}
      <button
        type="button"
        onClick={onLogout}
        className="mt-auto h-[44px] px-4 font-[family-name:var(--font-text)] text-[14.5px] text-[var(--color-ink-soft)] underline"
      >
        Se déconnecter
      </button>
    </main>
  );
}
