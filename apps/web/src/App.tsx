import { Mascot } from "./components/mascot/Mascot.js";

// M0 placeholder: proves web and API are served from the same origin
// (docs/jalons.md, M0). Replaced by the real four-screen navigation once
// auth (M1) and the first course (M2) exist.
export function App() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Mascot pose="idle" />
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-ink)]">StudiaKids</h1>
      <p className="font-[family-name:var(--font-text)] text-[var(--color-ink-soft)]">On va faire des jeux avec tes cours !</p>
    </main>
  );
}
