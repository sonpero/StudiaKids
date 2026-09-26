import { present } from "@studiakids/mascot";
import type { ComparisonResultDto, PlayableExerciseDto } from "@studiakids/contracts";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { answerExercise, gameLabel, type Correction } from "../lib/play.js";
import { McqGame, TrueFalseGame } from "./games/ChoiceGames.js";
import { primary, quiet, secondary, text } from "./games/styles.js";
import { MatchingGame, ReorderingGame } from "./games/TapGames.js";
import { ClozeGame, DelayedCopyGame, MentalMathGame } from "./games/TypedGames.js";

export interface GameScreenProps {
  exercise: PlayableExerciseDto;
  onNext: () => void;
  onBack: () => void;
}

type GameBodyArgs = { exercise: PlayableExerciseDto; answered: boolean; onAnswer: (given: unknown) => void; onReread: () => void };

function GameBody({ exercise, answered, onAnswer, onReread }: GameBodyArgs) {
  switch (exercise.type) {
    case "mcq":
      return <McqGame question={exercise.question} options={exercise.options} onAnswer={onAnswer} />;
    case "true_false":
      return <TrueFalseGame statement={exercise.statement} onAnswer={onAnswer} />;
    case "matching":
      return <MatchingGame lefts={exercise.lefts} rights={exercise.rights} onAnswer={onAnswer} />;
    case "reordering":
      return <ReorderingGame elements={exercise.elements} onAnswer={onAnswer} />;
    case "cloze":
      return <ClozeGame text={exercise.text} blankCount={exercise.blankCount} onAnswer={onAnswer} />;
    case "mental_math":
      return <MentalMathGame question={exercise.question} onAnswer={onAnswer} />;
    case "delayed_copy":
      return <DelayedCopyGame wordOrPhrase={exercise.wordOrPhrase} displayDurationMs={exercise.displayDurationMs} answered={answered} onAnswer={onAnswer} onReread={onReread} />;
  }
}

// How long the right answer stays after a wrong one (« à valider »).
export const CORRECTION_MS = 4000;

// The right answer, said the way each game needs (texts « à valider »).
function correctionLines(type: PlayableExerciseDto["type"], correction: Correction): string[] {
  if (type === "mcq" && "chosenOption" in correction) return [`La bonne réponse : ${correction.chosenOption}`];
  if (type === "true_false" && "value" in correction && typeof correction.value === "boolean") return [correction.value ? "C'était vrai." : "C'était faux."];
  if (type === "mental_math" && "value" in correction && typeof correction.value === "string") return [`La bonne réponse : ${correction.value}`];
  if (type === "delayed_copy" && "text" in correction) return [`Le mot était : ${correction.text}`];
  if (type === "cloze" && "values" in correction) {
    return [correction.values.length === 1 ? `Le mot qui manquait : ${correction.values[0] ?? ""}` : `Les mots qui manquaient : ${correction.values.join(", ")}`];
  }
  if (type === "reordering" && "order" in correction) return [`Le bon ordre : ${correction.order.join(", ")}`];
  if (type === "matching" && "pairs" in correction) return ["Les bonnes paires :", ...correction.pairs.map((pair) => `${pair.left} → ${pair.right}`)];
  return [];
}

// docs/ui.md, "Jouer (M4)": the answer is built by tapping, sent on
// « Valider », and the mascot reacts at once through present() — joy for
// a right answer, a calm waiting otherwise, never sorry nor glitch.
export function GameScreen({ exercise, onNext, onBack }: GameScreenProps) {
  const [given, setGiven] = useState<unknown>(null);
  // A reread of the flash dictation: the answer is sent without a star.
  const [reread, setReread] = useState(false);
  const [round, setRound] = useState(0);
  const [variant] = useState(() => Math.floor(Math.random() * 3));
  const send = useMutation({ mutationFn: (answer: unknown) => answerExercise(exercise.id, answer, reread) });
  // Shown briefly after a wrong answer, then taken away.
  const correction = send.data?.correction;
  const [showCorrection, setShowCorrection] = useState(false);
  useEffect(() => {
    if (correction === undefined) return;
    setShowCorrection(true);
    const timer = setTimeout(() => setShowCorrection(false), CORRECTION_MS);
    return () => clearTimeout(timer);
  }, [correction]);

  function again(): void {
    send.reset();
    setGiven(null);
    setReread(false);
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
        {showCorrection && correction !== undefined && (
          <div role="status" className="flex flex-col gap-1 rounded-[15px] border-[3px] border-[var(--color-ink)] bg-white p-3 font-[family-name:var(--font-text)] text-[18px] text-[var(--color-ink)]">
            {correctionLines(exercise.type, correction).map((correctionLine) => (
              <p key={correctionLine}>{correctionLine}</p>
            ))}
          </div>
        )}
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
        <GameBody exercise={exercise} answered={answered} onAnswer={setGiven} onReread={() => setReread(true)} />
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
