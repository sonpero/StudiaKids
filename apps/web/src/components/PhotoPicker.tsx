import { useRef, type ChangeEvent } from "react";
import { button } from "./ui/styles.js";

export interface PhotoPickerProps {
  label: string;
  variant: "primary" | "secondary";
  disabled?: boolean;
  onPhoto: (file: File) => void;
}

// The camera input the jalon names (docs/jalons.md, M2): on a phone or a
// tablet it opens the camera. The button opens it; the input stays hidden.
export function PhotoPicker({ label, variant, disabled = false, onPhoto }: PhotoPickerProps) {
  const input = useRef<HTMLInputElement>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    // Cleared so that choosing the same file again still fires a change.
    event.target.value = "";
    if (file) onPhoto(file);
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => input.current?.click()}
        className={button[variant]}
      >
        {/* docs/design/accueil.png: a camera before the label. */}
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
        {label}
      </button>
      <input ref={input} type="file" accept="image/*" capture hidden onChange={handleChange} />
    </>
  );
}
