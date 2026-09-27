import type { ReactNode } from "react";

export type Tab = "read" | "play" | "tutor";

export interface TabBarProps {
  current: Tab;
  onHome: () => void;
  onRead: () => void;
  onPlay: () => void;
  onTutor: () => void;
}

// Line icons as docs/design/tuteur.png draws them: a 2px ink stroke.
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const ICONS: Record<Tab | "home", ReactNode> = {
  home: (
    <Icon>
      <path d="M3 11 12 4l9 7" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  ),
  read: (
    <Icon>
      <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z" />
      <path d="M5 18a2 2 0 0 1 2-2h12" />
    </Icon>
  ),
  play: (
    <Icon>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="15" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="9" cy="15" r="1" />
    </Icon>
  ),
  tutor: (
    <Icon>
      <path d="M5 5h14v10h-9l-4 4v-4H5z" />
    </Icon>
  ),
};

// docs/ui.md, "Navigation", as docs/design/tuteur.png draws it: cream (the
// safe area too), four equal tabs, the current one a peach pill kept clear
// of the tab's edges.
export function TabBar({ current, onHome, onRead, onPlay, onTutor }: TabBarProps) {
  const tab = (key: Tab | "home", label: string, onClick: () => void) => {
    const active = key === current;
    return (
      <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className="flex min-h-[44px] flex-1 p-[4px] font-[family-name:var(--font-display)] text-[13px] font-bold text-[var(--color-ink)]">
        <span
          data-pill
          className={`flex w-full flex-col items-center justify-center gap-[2px] rounded-[20px] border-[3px] py-[2px] ${active ? "border-[var(--color-ink)] bg-[var(--color-peche)]" : "border-transparent"}`}
        >
          {ICONS[key]}
          {label}
        </span>
      </button>
    );
  };
  return (
    <nav aria-label="Onglets" className="fixed inset-x-0 bottom-0 flex border-t-[3px] border-[var(--color-ink)] bg-[var(--color-canvas)] pb-[env(safe-area-inset-bottom)]">
      {tab("home", "Accueil", onHome)}
      {tab("read", "Lire", onRead)}
      {tab("play", "Jouer", onPlay)}
      {tab("tutor", "Tuteur", onTutor)}
    </nav>
  );
}
