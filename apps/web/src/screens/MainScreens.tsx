import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useCapture } from "../lib/use-capture.js";
import { CaptureScreen } from "./CaptureScreen.js";
import { COURSES_QUERY_KEY, HomeScreen } from "./HomeScreen.js";

export interface MainScreensProps {
  firstName: string;
  onLogout: () => void;
  reencode: (file: Blob) => Promise<Blob>;
}

type Screen = "home" | "capture";

// Navigation by screen state, no router (docs/ui.md, M2).
export function MainScreens({ firstName, onLogout, reencode }: MainScreensProps) {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>("home");
  const capture = useCapture(reencode);

  function goHome(): void {
    capture.reset();
    setScreen("home");
    void queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
  }

  async function handlePhoto(file: File): Promise<void> {
    setScreen("capture");
    if ((await capture.addPhoto(file)) === "gone") goHome();
  }

  async function handleDone(): Promise<void> {
    await capture.finish();
    goHome();
  }

  if (screen === "capture") {
    return (
      <CaptureScreen
        pages={capture.pages}
        error={capture.error}
        busy={capture.busy}
        onPhoto={(file) => void handlePhoto(file)}
        onDone={() => void handleDone()}
      />
    );
  }

  return (
    <HomeScreen
      firstName={firstName}
      onLogout={onLogout}
      onPhoto={(file) => {
        capture.reset();
        void handlePhoto(file);
      }}
    />
  );
}
