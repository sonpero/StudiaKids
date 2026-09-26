import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { TabBar, type Tab } from "../components/TabBar.js";
import { useCapture } from "../lib/use-capture.js";
import { CaptureScreen } from "./CaptureScreen.js";
import { CourseScreen } from "./CourseScreen.js";
import { COURSES_QUERY_KEY, HomeScreen } from "./HomeScreen.js";
import { GenerationPanel } from "./GenerationPanel.js";
import { PlayScreen } from "./PlayScreen.js";
import { ReaderScreen } from "./ReaderScreen.js";

export interface MainScreensProps {
  firstName: string;
  onLogout: () => void;
  reencode: (file: Blob) => Promise<Blob>;
}

// A confirmed course is shown under the tab bar, on its Lire or Jouer tab.
type Screen = { name: "home" } | { name: "capture" } | { name: "course"; courseId: string } | { name: "tabs"; courseId: string; tab: Tab };

// Navigation by screen state, no router (docs/ui.md, M2).
export function MainScreens({ firstName, onLogout, reencode }: MainScreensProps) {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const capture = useCapture(reencode);

  function goHome(): void {
    capture.reset();
    setScreen({ name: "home" });
    // The list and the banner (whose key starts with the same prefix).
    void queryClient.invalidateQueries({ queryKey: COURSES_QUERY_KEY });
  }

  async function handlePhoto(file: File): Promise<void> {
    setScreen({ name: "capture" });
    if ((await capture.addPhoto(file)) === "gone") goHome();
  }

  function startCapture(file: File): void {
    capture.reset();
    void handlePhoto(file);
  }

  async function handleDone(): Promise<void> {
    const courseId = await capture.finish();
    capture.reset();
    if (courseId) setScreen({ name: "course", courseId });
    else goHome();
  }

  if (screen.name === "course") {
    return <CourseScreen key={screen.courseId} courseId={screen.courseId} onHome={goHome} onPhoto={startCapture} />;
  }

  if (screen.name === "tabs") {
    const { courseId, tab } = screen;
    return (
      <>
        {tab === "read" ? (
          // Room under the text for the fixed tab bar.
          <div className="pb-[72px]">
            <ReaderScreen
              key={`read-${courseId}`}
              courseId={courseId}
              onHome={goHome}
              showHomeButton={false}
              footer={<GenerationPanel courseId={courseId} onPhoto={startCapture} />}
            />
          </div>
        ) : (
          <PlayScreen key={`play-${courseId}`} courseId={courseId} onHome={goHome} onPhoto={startCapture} />
        )}
        <TabBar
          current={tab}
          onHome={goHome}
          onRead={() => setScreen({ name: "tabs", courseId, tab: "read" })}
          onPlay={() => setScreen({ name: "tabs", courseId, tab: "play" })}
        />
      </>
    );
  }

  if (screen.name === "capture") {
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
      onPhoto={startCapture}
      onOpenCourse={(courseId) => setScreen({ name: "course", courseId })}
      onReadCourse={(courseId) => setScreen({ name: "tabs", courseId, tab: "read" })}
      onPlayCourse={(courseId) => setScreen({ name: "tabs", courseId, tab: "play" })}
      onResumeCapture={(course) => {
        capture.reset();
        capture.resume(course.id, course.pageCount);
        setScreen({ name: "capture" });
      }}
    />
  );
}
