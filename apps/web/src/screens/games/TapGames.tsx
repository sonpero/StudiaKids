import { useState } from "react";
import type { GameBodyProps } from "./ChoiceGames.js";
import { choice, text } from "./styles.js";

// Tap an item, then its answer (no drag and drop, docs/ui.md "Jouer (M4)").
// An answer used again moves to the new item; an item paired again takes
// its new answer.
export function MatchingGame({ lefts, rights, onAnswer }: { lefts: string[]; rights: string[] } & GameBodyProps<{ pairs: { left: string; right: string }[] }>) {
  const [pairs, setPairs] = useState<Map<string, string>>(new Map());
  const [chosen, setChosen] = useState<string | null>(null);

  function pairWith(right: string): void {
    if (chosen === null) return;
    const next = new Map([...pairs].filter(([, paired]) => paired !== right));
    next.set(chosen, right);
    setPairs(next);
    setChosen(null);
    onAnswer(next.size === lefts.length ? { pairs: lefts.map((left) => ({ left, right: next.get(left) ?? "" })) } : null);
  }

  return (
    <>
      <p className={text}>Touche un élément, puis sa réponse.</p>
      <ul aria-label="Les éléments à relier" className="flex w-full flex-col gap-3">
        {lefts.map((left) => (
          <li key={left} className="flex flex-col gap-1">
            <button type="button" aria-pressed={chosen === left} onClick={() => setChosen(left)} className={choice(chosen === left)}>
              {left}
            </button>
            {pairs.has(left) && <span className={text}>{`${left} → ${pairs.get(left) ?? ""}`}</span>}
          </li>
        ))}
      </ul>
      <ul aria-label="Les réponses" className="flex w-full flex-col gap-3">
        {rights.map((right) => (
          <li key={right}>
            <button type="button" onClick={() => pairWith(right)} className={choice(false)}>
              {right}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

// Tap the elements in order; a second tap on a placed one takes it back.
export function ReorderingGame({ elements, onAnswer }: { elements: string[] } & GameBodyProps<{ order: string[] }>) {
  const [order, setOrder] = useState<string[]>([]);

  function change(next: string[]): void {
    setOrder(next);
    onAnswer(next.length === elements.length ? { order: next } : null);
  }

  return (
    <>
      <p className={text}>Touche les éléments dans le bon ordre.</p>
      <ol aria-label="Ton ordre" className="flex w-full flex-col gap-3">
        {order.map((element, i) => (
          <li key={element}>
            <button type="button" aria-label={`${String(i + 1)}. ${element}`} onClick={() => change(order.filter((placed) => placed !== element))} className={choice(true)}>
              {`${String(i + 1)}. ${element}`}
            </button>
          </li>
        ))}
      </ol>
      <ul aria-label="À placer" className="flex w-full flex-col gap-3">
        {elements
          .filter((element) => !order.includes(element))
          .map((element) => (
            <li key={element}>
              <button type="button" onClick={() => change([...order, element])} className={choice(false)}>
                {element}
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}
