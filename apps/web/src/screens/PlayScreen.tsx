import type { PlayableExerciseDto } from "@studiakids/contracts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MascotSays } from "../components/ui/MascotSays.js";
import { card } from "../components/ui/styles.js";
import { gameLabel, listPlayableExercises } from "../lib/play.js";
import { GameScreen } from "./GameScreen.js";
import { GenerationPanel } from "./GenerationPanel.js";
import { SessionSummary } from "./SessionSummary.js";
import { secondary } from "./games/styles.js";

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
        <MascotSays pose="glitch" line="Oh, quelque chose a coincé. On réessaie ?" />
        <button type="button" onClick={() => void games.refetch()} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (!games.data) {
    content = (
      <MascotSays pose="waiting" line="Je cherche tes jeux…" />
    );
  } else if (games.data.exercises.length === 0) {
    content = (
      <>
        <MascotSays pose="idle" line="Pas encore de jeux pour ce cours." />
        <GenerationPanel courseId={courseId} onPhoto={onPhoto} onReady={() => void games.refetch()} />
      </>
    );
  } else {
    const { exercises, nextExerciseId } = games.data;
    content = (
      <>
        <h1 className="font-display text-titre font-bold text-ink">Tes jeux</h1>
        <ul className="flex w-full flex-col gap-3 text-left">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => setPlaying(exercise)}
                className={`${card} flex min-h-14 w-full flex-col items-start gap-0.5 p-3 text-left`}
              >
                <span className="font-display text-corps-l font-bold text-ink">{gameLabel(exercise.type)}</span>
                <span className="text-petit text-ink-soft">{exercise.itemTitle}</span>
                {exercise.id === nextExerciseId && <span className="mt-1 rounded-pastille border-2 border-ink bg-turquoise px-2 font-display text-mini font-bold text-ink">À toi de jouer !</span>}
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

  return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 pt-6 pb-24 text-center">{content}</main>;
}
