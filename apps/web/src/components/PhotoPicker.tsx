import { useRef, type ChangeEvent } from "react";

export interface PhotoPickerProps {
  label: string;
  variant: "primary" | "secondary";
  disabled?: boolean;
  onPhoto: (file: File) => void;
}

const VARIANTS = {
  primary: "bg-[var(--color-mandarine)] shadow-[0_5px_0_var(--color-ink)]",
  secondary: "bg-[var(--color-turquoise)] shadow-[0_4px_0_var(--color-ink)]",
};

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
        className={`h-[56px] w-full rounded-[15px] border-[3px] border-[var(--color-ink)] px-6 font-[family-name:var(--font-display)] text-[18px] font-bold text-[var(--color-ink)] disabled:opacity-60 ${VARIANTS[variant]}`}
      >
        {label}
      </button>
      <input ref={input} type="file" accept="image/*" capture hidden onChange={handleChange} />
    </>
  );
}
