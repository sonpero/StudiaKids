import { present, type Signal } from "@studiakids/mascot";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { MascotSays } from "../components/ui/MascotSays.js";
import { button, text } from "../components/ui/styles.js";
import { PhotoPicker } from "../components/PhotoPicker.js";
import { generationPollInterval, getGenerationStatus, startGeneration } from "../lib/generation.js";

export interface GenerationPanelProps {
  courseId: string;
  onPhoto: (file: File) => void;
  // The Jouer screen reads its list again once the games are ready.
  onReady?: () => void;
}

const { primary, secondary } = button;

// docs/ui.md, "Lire un cours et créer ses jeux (M3)": the games are never
// made by themselves, never shown as made before the jobs are over, and
// the child may leave at any time — nothing here blocks on them.
export function GenerationPanel({ courseId, onPhoto, onReady }: GenerationPanelProps) {
  const queryClient = useQueryClient();
  const queryKey = ["generation", courseId];
  const [startedAt] = useState(() => Date.now());
  const [variant] = useState(() => Math.floor(Math.random() * 2));
  const progress = useQuery({
    queryKey,
    queryFn: () => getGenerationStatus(courseId),
    refetchInterval: (query) => (query.state.data ? generationPollInterval(query.state.data.status, Date.now() - startedAt) : false),
  });
  const start = useMutation({
    mutationFn: () => startGeneration(courseId),
    onSuccess: (status) => queryClient.setQueryData(queryKey, status),
  });

  const isReady = progress.data?.status === "ready";
  useEffect(() => {
    if (isReady) onReady?.();
  }, [isReady, onReady]);

  const say = (signal: Signal) => {
    const { pose, line } = present(signal, variant);
    return <MascotSays pose={pose} line={line} />;
  };

  let content;
  if (progress.isError || start.isError) {
    content = (
      <>
        <MascotSays pose="glitch" line="Oh, quelque chose a coincé. On réessaie ?" />
        <button
          type="button"
          onClick={() => {
            start.reset();
            void progress.refetch();
          }}
          className={secondary}
        >
          Réessaie
        </button>
      </>
    );
  } else if (!progress.data) {
    content = null;
  } else {
    const { status, done, total } = progress.data;
    if (status === "not_started") {
      content = (
        <button type="button" disabled={start.isPending} onClick={() => start.mutate()} className={primary}>
          Créer mes jeux
        </button>
      );
    } else if (status === "splitting" || status === "generating") {
      content = (
        <>
          {say({ type: "generation-in-progress" })}
          {/* In game types (one job each): honest, never a made-up percentage. */}
          {total > 0 && <p className={text}>{`${String(done)} sur ${String(total)}`}</p>}
        </>
      );
    } else if (status === "ready") {
      content = say({ type: "generation-ready" });
    } else if (status === "insufficient_coverage") {
      content = (
        <>
          {say({ type: "generation-insufficient-coverage" })}
          <PhotoPicker label="Prendre une autre photo" variant="secondary" onPhoto={onPhoto} />
        </>
      );
    } else {
      content = (
        <>
          {say({ type: "generation-failed" })}
          <button type="button" disabled={start.isPending} onClick={() => start.mutate()} className={primary}>
            On réessaie
          </button>
        </>
      );
    }
  }

  return <section className="flex w-full flex-col items-center gap-3">{content}</section>;
}
