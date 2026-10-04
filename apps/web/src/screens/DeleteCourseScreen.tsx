import { present } from "@studiakids/mascot";
import { useMutation } from "@tanstack/react-query";
import { MascotSays } from "../components/ui/MascotSays.js";
import { button } from "../components/ui/styles.js";
import { deleteCourse } from "../lib/courses.js";

export interface DeleteCourseScreenProps {
  courseId: string;
  // From the courses already read by the home; without it, « Ce cours ».
  title?: string;
  onKeep: () => void;
  onDeleted: () => void;
}

// Deleting a confirmed course (decided on 2026-10-04, docs/ui.md): never in
// one tap. The calm mascot says what goes and what stays; keeping the
// course is the action put forward, deleting it the quieter one.
export function DeleteCourseScreen({ courseId, title, onKeep, onDeleted }: DeleteCourseScreenProps) {
  const remove = useMutation({ mutationFn: () => deleteCourse(courseId), onSuccess: onDeleted });
  const { pose, line } = present({ type: "course-delete-confirm", title }, 0);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-4 py-6 text-center">
      {remove.isError ? <MascotSays pose="glitch" line="Oh, quelque chose a coincé. On réessaie ?" role="alert" /> : <MascotSays pose={pose} line={line} />}
      <button type="button" onClick={onKeep} disabled={remove.isPending} className={button.primary}>
        Je garde mon cours
      </button>
      <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className={button.dashed}>
        {remove.isError ? "Réessaie" : "Supprimer le cours"}
      </button>
    </main>
  );
}
