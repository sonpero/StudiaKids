import { present } from "@studiakids/mascot";
import type { ComparisonResultDto, PlayableExerciseDto } from "@studiakids/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { PROGRESS_QUERY_KEY } from "../components/StarCounter.js";
import { ScreenHeader } from "../components/ui/ScreenHeader.js";
import { card } from "../components/ui/styles.js";
import { HttpError } from "../lib/http-error.js";
import { answerExercise, gameLabel, type Correction } from "../lib/play.js";
import { McqGame, TrueFalseGame } from "./games/ChoiceGames.js";
import { dashed, primary, secondary, text } from "./games/styles.js";
import { MatchingGame, ReorderingGame } from "./games/TapGames.js";
import { ClozeGame, DelayedCopyGame, MentalMathGame } from "./games/TypedGames.js";

export interface GameScreenProps {
  exercise: PlayableExerciseDto;
  onNext: () => void;
  onBack: () => void;
}

type GameBodyArgs = { exercise: PlayableExerciseDto; answered: boolean; flashing: boolean; onAnswer: (given: unknown) => void };

function GameBody({ exercise, answered, flashing, onAnswer }: GameBodyArgs) {
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
      return <DelayedCopyGame wordOrPhrase={exercise.wordOrPhrase} flashing={flashing} answered={answered} onAnswer={onAnswer} />;
  }
}

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
  // The flash dictation's word, shown for its duration, without countdown.
  const flashDuration = exercise.type === "delayed_copy" ? exercise.displayDurationMs : null;
  const [flashing, setFlashing] = useState(flashDuration !== null);
  useEffect(() => {
    if (!flashing || flashDuration === null) return;
    const timer = setTimeout(() => setFlashing(false), flashDuration);
    return () => clearTimeout(timer);
  }, [flashing, flashDuration]);
  const queryClient = useQueryClient();
  const send = useMutation({
    mutationFn: (answer: unknown) => answerExercise(exercise.id, answer, reread),
    // The answer brings the new counters: every counter on screen moves at once.
    onSuccess: ({ progress }) => {
      if (progress) queryClient.setQueryData(PROGRESS_QUERY_KEY, { total: progress.total, currentStreak: progress.currentStreak, bestStreak: progress.bestStreak });
    },
  });
  // Shown after a wrong answer until the child taps « Continuer » (M5):
  // never taken away by a timer.
  // Its course deleted meanwhile, from another device (2026-10-04): the
  // game closes quietly, as any screen whose course is gone (docs/ui.md).
  const gone = send.error instanceof HttpError && send.error.status === 404;
  useEffect(() => {
    if (gone) onBack();
  }, [gone, onBack]);
  const correction = send.data?.correction;
  const [showCorrection, setShowCorrection] = useState(false);
  useEffect(() => {
    if (correction !== undefined) setShowCorrection(true);
  }, [correction]);

  function again(): void {
    send.reset();
    setGiven(null);
    setReread(false);
    setFlashing(flashDuration !== null);
    setRound((n) => n + 1);
  }

  let feedback;
  if (send.isError && !gone) {
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
    // The joy dance: a streak bonus or a comeback (docs/modules/progress.md).
    const celebrate = correct ? (send.data.progress?.celebrate ?? null) : null;
    const { pose, line } = present({ type: "game-answer", correct, streakBonus: celebrate === "streak-bonus" }, variant);
    const starsWon = correct ? (send.data.progress?.stars ?? 0) : 0;
    feedback = (
      <>
        {/* docs/design/bravo.png: a right answer's line as the screen's big title. */}
        {correct && <p className="font-display text-titre font-bold text-balance text-ink">{line}</p>}
        <div className="relative">
          <Mascot pose={pose} motion={celebrate === null ? undefined : "dance"} />
          {starsWon > 0 && (
            // Decorative: the star counter says the new total.
            <span data-testid="stars-won" aria-hidden="true" className="absolute -top-2 -right-4 flex h-14 w-14 items-center justify-center rounded-pastille border-3 border-ink bg-soleil font-display text-sous-titre font-bold text-ink shadow-petite">
              +{starsWon}
            </span>
          )}
        </div>
        {!correct && <p className={text}>{line}</p>}
        {showCorrection && correction !== undefined && (
          <div role="status" className={`${card} flex w-full flex-col gap-1 p-3 font-text text-corps-l text-ink`}>
            {correctionLines(exercise.type, correction).map((correctionLine) => (
              <p key={correctionLine}>{correctionLine}</p>
            ))}
          </div>
        )}
        {showCorrection && correction !== undefined && (
          <button type="button" onClick={() => setShowCorrection(false)} className={secondary}>
            Continuer
          </button>
        )}
        <button type="button" onClick={onNext} className={primary}>
          Jeu suivant
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
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
  const right = send.data !== undefined && send.data.units.every((unit) => unit.correct);
  return (
    // docs/design/flash.png: the whole screen goes night violet for the flash.
    <div className={`min-h-dvh w-full ${flashing ? "bg-violet-nuit" : ""}`}>
      <main className={`mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 pt-6 pb-24 text-center ${flashing ? "bg-violet-nuit" : ""}`}>
        <ScreenHeader title={gameLabel(exercise.type)} back={{ label: "Tous les jeux", icon: "close", onClick: onBack }} dark={flashing} />
        <p className={flashing ? "font-text text-corps text-canvas" : text}>{exercise.itemTitle}</p>
        {/* A right answer gives the screen to the bravo (docs/design/bravo.png). */}
        {!right && (
          <fieldset key={round} disabled={answered} className="flex w-full flex-col items-center gap-3">
            <GameBody exercise={exercise} answered={answered} flashing={flashing} onAnswer={setGiven} />
          </fieldset>
        )}
        {!answered && !flashing && (
          <button type="button" disabled={given === null || send.isPending} onClick={() => send.mutate(given)} className={primary}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
            Valider
          </button>
        )}
        {/* docs/design/saisie.png: a second, quieter way under « Valider ». */}
        {flashDuration !== null && !answered && !flashing && (
          <button
            type="button"
            onClick={() => {
              setReread(true);
              setFlashing(true);
            }}
            className={dashed}
          >
            Je relis le mot
          </button>
        )}
        {feedback}
      </main>
    </div>
  );
}
