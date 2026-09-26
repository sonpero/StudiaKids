import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mascot } from "./components/mascot/Mascot.js";
import { fetchMe, logout } from "./lib/api.js";
import { reencodePhoto } from "./lib/reencode.js";
import { MainScreens } from "./screens/MainScreens.js";
import { LoginScreen } from "./screens/LoginScreen.js";

const ME_QUERY_KEY = ["me"];

// docs/ui.md, "États requis": chargement (session en cours de vérification),
// vide (pas de session → invitation à se connecter, l'action étant le
// formulaire lui-même), erreur (vérification impossible), prêt (connecté).
export function App() {
  const queryClient = useQueryClient();
  const meQuery = useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchMe });

  if (meQuery.isPending) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Mascot pose="waiting" />
        <p className="font-[family-name:var(--font-text)] text-[var(--color-ink-soft)]">On vérifie ta connexion…</p>
      </main>
    );
  }

  if (meQuery.isError) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Mascot pose="glitch" />
        <p className="font-[family-name:var(--font-text)] text-[var(--color-ink-soft)]">
          Un souci technique nous empêche de vérifier ta connexion.
        </p>
        <button
          type="button"
          onClick={() => void meQuery.refetch()}
          className="h-[56px] rounded-[15px] border-[3px] border-[var(--color-ink)] bg-[var(--color-turquoise)] px-6 font-[family-name:var(--font-display)] font-bold text-[var(--color-ink)] shadow-[0_5px_0_var(--color-ink)]"
        >
          Réessaie
        </button>
      </main>
    );
  }

  if (!meQuery.data) {
    return <LoginScreen onLoggedIn={() => void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY })} />;
  }

  const account = meQuery.data;

  async function handleLogout(): Promise<void> {
    await logout();
    await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  }

  return <MainScreens firstName={account.firstName} onLogout={() => void handleLogout()} reencode={reencodePhoto} />;
}
