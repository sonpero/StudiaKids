import { PhotoPicker } from "../components/PhotoPicker.js";
import { MascotSays } from "../components/ui/MascotSays.js";
import { button } from "../components/ui/styles.js";
import type { CaptureError, CapturedPage } from "../lib/use-capture.js";

// Same value as ingestion's MAX_PAGES_PER_COURSE (the server refuses a
// sixth page anyway); the web bundle cannot import packages/core.
const MAX_PAGES = 5;

// Proposed in docs/ui.md, "à valider".
const REFUSALS: Record<CaptureError, { pose: "sorry" | "glitch"; line: string }> = {
  too_large: { pose: "sorry", line: "Cette photo est trop lourde. On en prend une autre ?" },
  unsupported: { pose: "sorry", line: "Je n'arrive pas à ouvrir cette photo. On en prend une autre ?" },
  unreadable: { pose: "sorry", line: "Je n'arrive pas à ouvrir cette photo. On en prend une autre ?" },
  duplicate: { pose: "sorry", line: "Tu as déjà pris cette page !" },
  upload_failed: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  locked: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  too_many_pages: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  missing_file: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  no_pages: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  not_ready: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  already_confirmed: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
  not_failed: { pose: "glitch", line: "Oh, la photo n'est pas partie. On réessaie ?" },
};

export interface CaptureScreenProps {
  pages: CapturedPage[];
  error: CaptureError | null;
  busy: boolean;
  onPhoto: (file: File) => void;
  onDone: () => void;
}

// docs/ui.md, "Photographier un cours (M2)", "Capture": thumbnails of the
// pages taken, « Une autre page » (gone at the fifth) and « C'est tout ! ».
export function CaptureScreen({ pages, error, busy, onPhoto, onDone }: CaptureScreenProps) {
  const refusal = error ? REFUSALS[error] : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center gap-4 px-4 py-6 text-center">
      {refusal && <MascotSays pose={refusal.pose} line={refusal.line} role="alert" />}
      {pages.length > 0 && (
        <ul className="grid w-full grid-cols-3 gap-3">
          {pages.map((page, i) => (
            <li key={page.index} className="rounded-carte border-3 border-ink bg-white p-1 shadow-moyenne">
              <img src={page.url} alt={`Page ${String(i + 1)}`} className="aspect-[3/4] w-full rounded-bouton object-cover" />
            </li>
          ))}
        </ul>
      )}
      {busy && <p className="font-text text-corps text-ink-soft">J'envoie ta photo…</p>}
      <div className="mt-auto flex w-full flex-col gap-3">
        {pages.length === 0 && <PhotoPicker label="Photographier un cours" variant="primary" disabled={busy} onPhoto={onPhoto} />}
        {pages.length > 0 && pages.length < MAX_PAGES && <PhotoPicker label="Une autre page" variant="secondary" disabled={busy} onPhoto={onPhoto} />}
        <button
          type="button"
          disabled={pages.length === 0 || busy}
          onClick={onDone}
          className={button.primary}
        >
          C'est tout !
        </button>
      </div>
    </main>
  );
}
