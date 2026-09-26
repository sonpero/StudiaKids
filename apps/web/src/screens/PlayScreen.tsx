import type { PlayableExerciseDto } from "@studiakids/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { gameLabel, listPlayableExercises } from "../lib/play.js";
import { GameScreen } from "./GameScreen.js";
import { GenerationPanel } from "./GenerationPanel.js";
import { SessionSummary } from "./SessionSummary.js";
import { secondary, text } from "./games/styles.js";

export interface PlayScreenProps {
  courseId: string;
  onHome: () => void;
  onPhoto: (file: File) => void;
}

// docs/ui.md, "Jouer (M4)": the course's games, then one game at a time.
export function PlayScreen({ courseId, onHome, onPhoto }: PlayScreenProps) {
  const games = useQuery({ queryKey: ["play", courseId], queryFn: () => listPlayableExercises(courseId) });
  const [playing, setPlaying] = useState<PlayableExerciseDto | null>(null);
  // A session: from entering Jouer to « J'ai fini » or the end of the list
  // (docs/ui.md, M5) — an instant kept here only, no table.
  const [since, setSince] = useState(() => new Date().toISOString());
  const [summary, setSummary] = useState(false);

  const gone = games.data === null;
  useEffect(() => {
    if (gone) onHome();
  }, [gone, onHome]);

  if (summary) {
    return (
      <SessionSummary
        since={since}
        onMore={() => {
          setSince(new Date().toISOString());
          setSummary(false);
          void games.refetch();
        }}
        onHome={onHome}
      />
    );
  }

  if (playing) {
    const list = games.data?.exercises ?? [];
    // The next of the list; after the last, the session ends on its summary.
    const next = list[list.findIndex((exercise) => exercise.id === playing.id) + 1] ?? null;
    return (
      <GameScreen
        key={playing.id}
        exercise={playing}
        onNext={() => {
          setPlaying(next);
          if (next === null) setSummary(true);
        }}
        onBack={() => {
          setPlaying(null);
          void games.refetch();
        }}
      />
    );
  }

  let content;
  if (games.isError) {
    content = (
      <>
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button type="button" onClick={() => void games.refetch()} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (!games.data) {
    content = (
      <>
        <Mascot pose="waiting" />
        <p className={text}>Je cherche tes jeux…</p>
      </>
    );
  } else if (games.data.exercises.length === 0) {
    content = (
      <>
        <p className={text}>Pas encore de jeux pour ce cours.</p>
        <GenerationPanel courseId={courseId} onPhoto={onPhoto} onReady={() => void games.refetch()} />
      </>
    );
  } else {
    const { exercises, nextExerciseId } = games.data;
    content = (
      <>
        <h1 className="font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">Tes jeux</h1>
        <ul className="flex w-full flex-col gap-3 text-left">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => setPlaying(exercise)}
                className="flex min-h-[56px] w-full flex-col rounded-[20px] border-[3px] border-[var(--color-ink)] bg-white p-3 text-left shadow-[0_4px_0_var(--color-ink)]"
              >
                <span className="font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)]">{gameLabel(exercise.type)}</span>
                <span className="text-[14.5px] text-[var(--color-ink-soft)]">{exercise.itemTitle}</span>
                {exercise.id === nextExerciseId && <span className="text-[14.5px] font-bold text-[var(--color-ink)]">À toi de jouer !</span>}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setSummary(true)} className={secondary}>
          J'ai fini
        </button>
      </>
    );
  }

  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 pt-6 pb-[96px] text-center">{content}</main>;
}
