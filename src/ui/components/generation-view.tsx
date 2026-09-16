/** Window body for a running artifact generation: a fun loading word. */

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { useArtifactStore } from "../store/artifact-store";
import { useWindowStore } from "../store/window-store";
import { randomLoadingWord } from "../utils/loading-words";

const WORD_INTERVAL_MS = 2200;

const STATUS_BADGE = {
  cancelled: "bg-white/10 text-white/50",
  done: "bg-green-400/10 text-green-400",
  error: "bg-red-500/10 text-red-400",
  running: "bg-amber-400/10 text-amber-300",
} as const;

const STATUS_DOT = {
  cancelled: "bg-white/40",
  done: "bg-green-400",
  error: "bg-red-400",
  running: "animate-pulse bg-amber-300",
} as const;

const STATUS_LABEL = {
  cancelled: "Cancelled",
  done: "Ready",
  error: "Failed",
  running: "Running",
} as const;

/** Cycles playful words so a long generation never feels frozen. */
const LoadingWord = () => {
  const [word, setWord] = useState(() => randomLoadingWord());

  useEffect(() => {
    const timer = setInterval(() => {
      setWord((previousWord) => randomLoadingWord(previousWord));
    }, WORD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className="animate-word-fade text-xl text-white/80" key={word}>
      {word}&hellip;
    </span>
  );
};

interface GenerationViewProps {
  windowId: string;
}

export const GenerationView = ({ windowId }: GenerationViewProps) => {
  const generation = useArtifactStore((s) => s.generations[windowId]);
  const cancel = useArtifactStore((s) => s.cancel);

  // Closing the window while the agent is still running stops the work.
  // A cleanup that runs while the window is still present is not a close:
  // StrictMode's dev-only remount and the success conversion both unmount
  // this view without removing the window, so they must not cancel.
  useEffect(
    () => () => {
      const windowStillOpen =
        useWindowStore.getState().windows[windowId] !== undefined;
      if (windowStillOpen) {
        return;
      }
      const artifactStore = useArtifactStore.getState();
      if (artifactStore.generations[windowId]?.status === "running") {
        artifactStore.cancel(windowId);
      }
      artifactStore.forget(windowId);
    },
    [windowId]
  );

  if (!generation) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0d0d0d] text-xs text-white/35">
        No active generation
      </div>
    );
  }

  const running = generation.status === "running";

  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/5 px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-white/40">
          <Sparkles className="shrink-0" size={12} />
          <span className="truncate">{generation.providerLabel}</span>
        </span>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${STATUS_BADGE[generation.status]}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[generation.status]}`}
          />
          {STATUS_LABEL[generation.status]}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        {running ? (
          <LoadingWord />
        ) : (
          <span
            className={`text-sm ${
              generation.status === "cancelled"
                ? "text-white/50"
                : "text-red-400"
            }`}
          >
            {generation.error ?? "Generation failed."}
          </span>
        )}
      </div>

      {running && (
        <div className="flex shrink-0 justify-end border-t border-white/5 px-3 py-2">
          <button
            type="button"
            onClick={() => cancel(windowId)}
            className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/70 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};
