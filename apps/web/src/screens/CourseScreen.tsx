import { present, type Signal } from "@studiakids/mascot";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { confirmCourse, getCourse, pageFileUrl, pollInterval, rejectCourse, retryExtraction } from "../lib/courses.js";
import { subjectLabel } from "../lib/subjects.js";

export interface CourseScreenProps {
  courseId: string;
  onHome: () => void;
  onPhoto: (file: File) => void;
}

const text = "font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)]";
const primary =
  "h-[56px] w-full rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-mandarine)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_5px_0_var(--color-ink)] disabled:opacity-60";
const secondary =
  "h-[56px] w-full rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] shadow-[0_4px_0_var(--color-ink)] disabled:opacity-60";
const quiet = "h-[44px] w-full px-4 font-[family-name:var(--font-text)] text-[16px] text-[var(--color-ink-soft)] underline";

// docs/ui.md, "Photographier un cours (M2)": the waiting screen, the
// unusable photo (sorry), the technical failure (glitch) and the
// confirmation, all for the course being read. Never shows the model's
// own reason, never anything settled before the reading is over.
export function CourseScreen({ courseId, onHome, onPhoto }: CourseScreenProps) {
  const [startedAt] = useState(() => Date.now());
  const [variant] = useState(() => Math.floor(Math.random() * 2));
  const [acting, setActing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => getCourse(courseId),
    refetchInterval: (query) => (query.state.data ? pollInterval(query.state.data.extractionStatus, Date.now() - startedAt) : false),
  });

  const gone = course.data === null;
  useEffect(() => {
    if (gone) onHome();
  }, [gone, onHome]);

  async function act(action: () => Promise<void>): Promise<void> {
    setActing(true);
    try {
      await action();
    } finally {
      setActing(false);
    }
  }

  // Drops the course, then opens the camera: the next photo starts a new
  // course (docs/modules/ingestion.md, rejectCourse).
  function retake(): void {
    void act(async () => {
      await rejectCourse(courseId);
      input.current?.click();
    });
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPhoto(file);
  }

  const retakeButton = (
    <button type="button" disabled={acting} onClick={retake} className={secondary}>
      Je reprends la photo
    </button>
  );

  const say = (signal: Signal) => present(signal, variant);
  // undefined while loading, null once gone: both show the waiting state.
  const data = course.data;
  let content;
  if (course.isError) {
    content = (
      <>
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button type="button" onClick={() => void course.refetch()} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (!data || data.extractionStatus === "pending" || data.extractionStatus === "running") {
    const { pose, line } = say({ type: "extraction-in-progress" });
    content = (
      <>
        <Mascot pose={pose} />
        <p className={text}>{line}</p>
        <button type="button" onClick={onHome} className={quiet}>
          Retour à l'accueil
        </button>
      </>
    );
  } else if (data.extractionStatus === "illegible" || data.extractionStatus === "not_a_course_page") {
    // The signal's reason is the model's own text: never displayed.
    const { pose, line } = say(
      data.extractionStatus === "illegible" ? { type: "extraction-illegible", reason: "" } : { type: "extraction-not-a-course-page" },
    );
    content = (
      <>
        <Mascot pose={pose} />
        <p className={text}>{line}</p>
        {retakeButton}
      </>
    );
  } else if (data.extractionStatus === "failed") {
    const { pose, line } = say({ type: "extraction-failed" });
    content = (
      <>
        <Mascot pose={pose} />
        <p className={text}>{line}</p>
        <button
          type="button"
          disabled={acting}
          onClick={() =>
            void act(async () => {
              await retryExtraction(courseId);
              await course.refetch();
            })
          }
          className={primary}
        >
          On réessaie
        </button>
        {retakeButton}
      </>
    );
  } else {
    const ready = data;
    content = (
      <>
        <img
          src={pageFileUrl(courseId, 0)}
          alt="Ta photo"
          className="max-h-[40dvh] w-auto rounded-[20px] border-[3px] border-[var(--color-ink)] object-contain"
        />
        <h1 className="font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">{ready.title}</h1>
        <p className="flex items-center gap-2">
          <span
            style={{ backgroundColor: `var(--${ready.color})` }}
            className="rounded-[999px] border-[2px] border-[var(--color-ink)] px-3 font-[family-name:var(--font-display)] text-[16px] font-bold text-[var(--color-ink)]"
          >
            {ready.subject ? subjectLabel(ready.subject) : ""}
          </span>
          <span className="rounded-[999px] border-[2px] border-[var(--color-ink)] px-3 font-[family-name:var(--font-display)] text-[16px] font-bold text-[var(--color-ink)]">
            {ready.grade}
          </span>
        </p>
        <div className="mt-auto flex w-full flex-col gap-3">
          <button
            type="button"
            disabled={acting}
            onClick={() =>
              void act(async () => {
                await confirmCourse(courseId);
                onHome();
              })
            }
            className={primary}
          >
            Oui, c'est ça !
          </button>
          {retakeButton}
        </div>
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 py-6 text-center">
      {content}
      <input ref={input} type="file" accept="image/*" capture hidden onChange={handleFile} />
    </main>
  );
}
