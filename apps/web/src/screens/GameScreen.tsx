import { present } from "@studiakids/mascot";
import type { ComparisonResultDto, PlayableExerciseDto } from "@studiakids/contracts";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { answerExercise, gameLabel } from "../lib/play.js";
import { McqGame, TrueFalseGame } from "./games/ChoiceGames.js";
import { primary, quiet, secondary, text } from "./games/styles.js";
import { MatchingGame, ReorderingGame } from "./games/TapGames.js";

export interface GameScreenProps {
  exercise: PlayableExerciseDto;
  onNext: () => void;
  onBack: () => void;
}

function GameBody({ exercise, onAnswer }: { exercise: PlayableExerciseDto; onAnswer: (given: unknown) => void }) {
  switch (exercise.type) {
    case "mcq":
      return <McqGame question={exercise.question} options={exercise.options} onAnswer={onAnswer} />;
    case "true_false":
      return <TrueFalseGame statement={exercise.statement} onAnswer={onAnswer} />;
    case "matching":
      return <MatchingGame lefts={exercise.lefts} rights={exercise.rights} onAnswer={onAnswer} />;
    case "reordering":
      return <ReorderingGame elements={exercise.elements} onAnswer={onAnswer} />;
    default:
      return null;
  }
}

// docs/ui.md, "Jouer (M4)": the answer is built by tapping, sent on
// « Valider », and the mascot reacts at once through present() — joy for
// a right answer, a calm waiting otherwise, never sorry nor glitch.
export function GameScreen({ exercise, onNext, onBack }: GameScreenProps) {
  const [given, setGiven] = useState<unknown>(null);
  const [round, setRound] = useState(0);
  const [variant] = useState(() => Math.floor(Math.random() * 3));
  const send = useMutation({ mutationFn: (answer: unknown) => answerExercise(exercise.id, answer, false) });

  function again(): void {
    send.reset();
    setGiven(null);
    setRound((n) => n + 1);
  }

  let feedback;
  if (send.isError) {
    feedback = (
      <>
        <Mascot pose="glitch" />
        <p className={text}>Oh, quelque chose a coincé. On réessaie ?</p>
        <button type="button" onClick={() => send.mutate(given)} className={secondary}>
          Réessaie
        </button>
      </>
    );
  } else if (send.data) {
    const result: ComparisonResultDto = send.data;
    const correct = result.units.every((unit) => unit.correct);
    const { pose, line } = present({ type: "game-answer", correct, streakBonus: false }, variant);
    feedback = (
      <>
        <Mascot pose={pose} />
        <p className={text}>{line}</p>
        <button type="button" onClick={onNext} className={primary}>
          Jeu suivant
        </button>
        {!correct && (
          <button type="button" onClick={again} className={secondary}>
            Encore une fois
          </button>
        )}
      </>
    );
  }

  const answered = send.data !== undefined || send.isError;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 pt-6 pb-[96px] text-center">
      <h1 className="font-[family-name:var(--font-display)] text-[27px] font-bold text-[var(--color-ink)]">{gameLabel(exercise.type)}</h1>
      <p className={text}>{exercise.itemTitle}</p>
      <fieldset key={round} disabled={answered} className="flex w-full flex-col items-center gap-3">
        <GameBody exercise={exercise} onAnswer={setGiven} />
      </fieldset>
      {!answered && (
        <button type="button" disabled={given === null || send.isPending} onClick={() => send.mutate(given)} className={primary}>
          Valider
        </button>
      )}
      {feedback}
      <button type="button" onClick={onBack} className={quiet}>
        Tous les jeux
      </button>
    </main>
  );
}
