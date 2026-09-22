import { useId, useState, type FormEvent } from "react";
import { Mascot } from "../components/mascot/Mascot.js";
import { login } from "../lib/api.js";

export interface LoginScreenProps {
  onLoggedIn: () => void;
}

// docs/ui.md, "Erreur": ce qui s'est passé, en langage d'enfant, jamais un
// code d'erreur brut. This screen is adult-facing (docs/ui.md: "peut rester
// simple et sobre"), so plain French is enough — no mascot-voiced copy
// required here specifically.
const ERROR_MESSAGES = {
  invalid_credentials: "Identifiant ou mot de passe incorrect.",
  rate_limited: "Trop d'essais. Réessaie dans quelques minutes.",
} as const;

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const usernameId = useId();
  const passwordId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await login(username, password);
      if (result.ok) {
        onLoggedIn();
      } else {
        setError(ERROR_MESSAGES[result.error]);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Mascot pose="idle" />
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--color-ink)]">StudiaKids</h1>
      <form
        onSubmit={(event) => {
          void handleSubmit(event);
        }}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <label htmlFor={usernameId} className="flex flex-col gap-1 text-left">
          <span className="text-[14.5px] text-[var(--color-ink-soft)]">Identifiant</span>
          <input
            id={usernameId}
            className="h-[44px] rounded-[15px] border-[3px] border-[var(--color-ink)] px-3 font-[family-name:var(--font-text)]"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label htmlFor={passwordId} className="flex flex-col gap-1 text-left">
          <span className="text-[14.5px] text-[var(--color-ink-soft)]">Mot de passe</span>
          <input
            id={passwordId}
            type="password"
            className="h-[44px] rounded-[15px] border-[3px] border-[var(--color-ink)] px-3 font-[family-name:var(--font-text)]"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-[var(--color-ink)]">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="h-[56px] rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-mandarine)] font-[family-name:var(--font-display)] font-bold text-[var(--color-ink)] shadow-[0_5px_0_var(--color-ink)] disabled:opacity-60"
        >
          Se connecter
        </button>
      </form>
    </main>
  );
}
