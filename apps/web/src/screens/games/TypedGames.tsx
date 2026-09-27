import { useState } from "react";
import { Mascot } from "../../components/mascot/Mascot.js";
import type { GameBodyProps } from "./ChoiceGames.js";
import { prompt, text } from "./styles.js";

const field =
  "h-12 rounded-bouton border-3 border-ink bg-white px-3 font-text text-corps-l text-ink";

// The text with a field in place of each {{n}}; complete once every blank
// holds something other than spaces.
export function ClozeGame({ text: lesson, blankCount, onAnswer }: { text: string; blankCount: number } & GameBodyProps<{ values: string[] }>) {
  const [values, setValues] = useState<string[]>(() => Array.from({ length: blankCount }, () => ""));
  const parts = lesson.split(/\{\{(\d+)\}\}/);

  function change(index: number, value: string): void {
    const next = values.map((current, i) => (i === index ? value : current));
    setValues(next);
    onAnswer(next.every((v) => v.trim() !== "") ? { values: next } : null);
  }

  return (
    <p className={`${prompt} leading-trous`}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>;
        const index = Number(part);
        return (
          <input
            key={i}
            type="text"
            aria-label={`Trou ${String(index + 1)}`}
            value={values[index] ?? ""}
            onChange={(event) => change(index, event.target.value)}
            className={`${field} mx-1 w-36`}
          />
        );
      })}
    </p>
  );
}

export function MentalMathGame({ question, onAnswer }: { question: string } & GameBodyProps<{ value: string }>) {
  const [value, setValue] = useState("");
  return (
    <>
      <p className="font-display text-titre font-bold text-ink">{question}</p>
      <label className="flex w-full flex-col gap-2">
        <span className={text}>Ta réponse</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            onAnswer(event.target.value.trim() === "" ? null : { value: event.target.value });
          }}
          className={field}
        />
      </label>
    </>
  );
}

// docs/modules/game-engine.md, "Copie différée": the word alone on the
// violet flash for its grade's duration — no countdown shown — then the
// field, where nothing corrects the child's spelling. The screen holds the
// flash's timing and « Je relis le mot » (GameScreen); what was typed stays
// here across a reread.
export function DelayedCopyGame({ wordOrPhrase, flashing, answered, onAnswer }: { wordOrPhrase: string; flashing: boolean; answered: boolean } & GameBodyProps<{ text: string }>) {
  const [value, setValue] = useState("");

  if (flashing) {
    return (
      <>
        {/* docs/design/flash.png: the word on a cream card, on the night violet. */}
        <div data-testid="flash" className="flex w-full justify-center bg-violet-nuit">
          <div data-testid="flash-card" className="flex min-h-40 w-full items-center justify-center rounded-grande-carte border-3 border-ink bg-canvas p-6 shadow-grande-carte">
            <p className="font-display text-titre-xl font-bold text-ink">{wordOrPhrase}</p>
          </div>
        </div>
        <Mascot pose="watching" size="md" />
      </>
    );
  }

  return (
    <>
      {!answered && (
        <div className="self-start">
          <Mascot pose="waiting" size="md" />
        </div>
      )}
      <label className="flex w-full flex-col gap-2 text-left">
        <span className="font-display text-sous-titre font-bold text-ink">Écris le mot</span>
        <input
          type="text"
          value={value}
          autoCorrect="off"
          autoCapitalize="off"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setValue(event.target.value);
            onAnswer(event.target.value.trim() === "" ? null : { text: event.target.value });
          }}
          className="h-16 w-full rounded-carte border-3 border-mandarine bg-white px-4 text-center font-display text-titre font-bold tracking-widest text-ink shadow-moyenne focus:outline-none"
        />
      </label>
    </>
  );
}
