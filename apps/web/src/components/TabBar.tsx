export type Tab = "read" | "play";

export interface TabBarProps {
  current: Tab;
  onHome: () => void;
  onRead: () => void;
  onPlay: () => void;
}

const tab = "flex h-[56px] flex-1 flex-col items-center justify-center font-[family-name:var(--font-display)] text-[14.5px] font-bold text-[var(--color-ink)]";

// docs/ui.md, "Navigation": fixed at the bottom, every width, the safe
// area added to its height. Tuteur arrives in M6.
export function TabBar({ current, onHome, onRead, onPlay }: TabBarProps) {
  const mark = (name: Tab) => (current === name ? { "aria-current": "page" as const, className: `${tab} bg-[var(--color-soleil)]` } : { className: tab });
  return (
    <nav
      aria-label="Onglets"
      className="fixed inset-x-0 bottom-0 flex border-t-[3px] border-[var(--color-ink)] bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <button type="button" onClick={onHome} className={tab}>
        Accueil
      </button>
      <button type="button" onClick={onRead} {...mark("read")}>
        Lire
      </button>
      <button type="button" onClick={onPlay} {...mark("play")}>
        Jouer
      </button>
    </nav>
  );
}
