import { present } from "@studiakids/mascot";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { PhotoPicker } from "../components/PhotoPicker.js";
import { listCourses } from "../lib/courses.js";
import { subjectLabel } from "../lib/subjects.js";

export const COURSES_QUERY_KEY = ["courses"];

export interface HomeScreenProps {
  firstName: string;
  onPhoto: (file: File) => void;
  onLogout: () => void;
}

const text = "font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)]";

// docs/ui.md, "Photographier un cours (M2)" and "États requis": loading,
// error, empty and ready, each with the mascot and a sentence.
export function HomeScreen({ firstName, onPhoto, onLogout }: HomeScreenProps) {
  const courses = useQuery({ queryKey: COURSES_QUERY_KEY, queryFn: listCourses });
  // Which of the catalogue's lines to say; the choice is the caller's
  // (docs/modules/mascot.md, "variantIndex").
  const [variant] = useState(() => Math.floor(Math.random() * 2));

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
    const { pose, line } = present({ type: "home", hasExistingCourses: list.length > 0 }, variant);
    body = (
      <>
        <Mascot pose={pose} />
        <p className={text}>{line}</p>
        <PhotoPicker label="Photographier un cours" variant="primary" onPhoto={onPhoto} />
        {list.length > 0 && (
          <section className="flex w-full flex-col gap-3 text-left">
            <h2 className="font-[family-name:var(--font-display)] text-[20px] font-bold text-[var(--color-ink)]">Mes cours</h2>
            <ul className="flex flex-col gap-3">
              {list.map((course) => (
                <li key={course.id}>
                  {/* Opens the reader from M3 on; nothing to open in M2. */}
                  <button
                    type="button"
                    aria-disabled="true"
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
      <h1 className="self-start font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">Salut {firstName} !</h1>
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
