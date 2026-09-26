import { useState } from "react";
import { choice, prompt } from "./styles.js";

// A game reports its answer as it is built; null while incomplete.
export interface GameBodyProps<T> {
  onAnswer: (given: T | null) => void;
}

export function McqGame({ question, options, onAnswer }: { question: string; options: string[] } & GameBodyProps<{ chosenOption: string }>) {
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <>
      <p className={prompt}>{question}</p>
      <ul className="flex w-full flex-col gap-3">
        {options.map((option) => (
          <li key={option}>
            <button
              type="button"
              aria-pressed={chosen === option}
              onClick={() => {
                setChosen(option);
                onAnswer({ chosenOption: option });
              }}
              className={choice(chosen === option)}
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function TrueFalseGame({ statement, onAnswer }: { statement: string } & GameBodyProps<{ value: boolean }>) {
  const [chosen, setChosen] = useState<boolean | null>(null);
  return (
    <>
      <p className={prompt}>{statement}</p>
      <div className="flex w-full gap-3">
        {([true, false] as const).map((value) => (
          <button
            key={String(value)}
            type="button"
            aria-pressed={chosen === value}
            onClick={() => {
              setChosen(value);
              onAnswer({ value });
            }}
            className={`${choice(chosen === value)} text-center`}
          >
            {value ? "Vrai" : "Faux"}
          </button>
        ))}
      </div>
    </>
  );
}
