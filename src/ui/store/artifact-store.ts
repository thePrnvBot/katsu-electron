/** Renderer state for running sandboxed artifact generations. */

import { create } from "zustand";

import type { ArtifactProviderId } from "../../shared/contract";
import { createFilePreviewFromPath } from "../utils/file-preview";
import { ignoreFailure } from "../utils/ignore-failure";
import {
  openGenerationWindow,
  showArtifactInWindow,
} from "../utils/open-preview-window";
import { projectNameFromPrompt } from "../utils/project-name";
import { useWindowStore } from "./window-store";

/** Each run is a full provider CLI process, so cap how many run at once. */
export const MAX_PARALLEL_GENERATIONS = 3;

interface ArtifactGeneration {
  readonly generationId: string;
  readonly windowId: string;
  readonly providerId: ArtifactProviderId;
  readonly providerLabel: string;
  readonly projectName: string;
  readonly prompt: string;
  status: "running" | "done" | "error" | "cancelled";
  error: string | null;
}

interface ArtifactState {
  /** One record per generation window, keyed by window id. */
  generations: Record<string, ArtifactGeneration>;
  start: (request: {
    prompt: string;
    providerId: ArtifactProviderId;
    providerLabel: string;
  }) => Promise<void>;
  cancel: (windowId: string) => void;
  /** Drop a finished/closed generation's record and its subscription. */
  forget: (windowId: string) => void;
}

/** One progress subscription per generation window. */
const progressUnsubscribes = new Map<string, () => void>();

const dropProgressSubscription = (windowId: string): void => {
  progressUnsubscribes.get(windowId)?.();
  progressUnsubscribes.delete(windowId);
};

export const countRunningGenerations = (
  generationsByWindow: Record<string, ArtifactGeneration>
): number => {
  let runningCount = 0;
  for (const generation of Object.values(generationsByWindow)) {
    if (generation.status === "running") {
      runningCount += 1;
    }
  }
  return runningCount;
};

export const useArtifactStore = create<ArtifactState>((set, get) => {
  /** Drop the progress subscription and settle a generation's final status. */
  const settleGeneration = (
    windowId: string,
    status: "error" | "cancelled",
    message: string
  ): void => {
    dropProgressSubscription(windowId);
    set((state) => {
      const generation = state.generations[windowId];
      if (!generation) {
        return state;
      }
      return {
        generations: {
          ...state.generations,
          [windowId]: { ...generation, error: message, status },
        },
      };
    });
  };

  return {
    cancel: (windowId) => {
      const currentGeneration = get().generations[windowId];
      if (!currentGeneration || currentGeneration.status !== "running") {
        return;
      }
      settleGeneration(windowId, "cancelled", "Cancelled.");
      if (currentGeneration.generationId !== "") {
        void ignoreFailure(
          window.electronAPI.cancelArtifact(currentGeneration.generationId)
        );
      }
    },

    forget: (windowId) => {
      dropProgressSubscription(windowId);
      set((state) => {
        if (!(windowId in state.generations)) {
          return state;
        }
        return {
          generations: Object.fromEntries(
            Object.entries(state.generations).filter(
              ([key]) => key !== windowId
            )
          ),
        };
      });
    },

    generations: {},

    start: async ({ prompt, providerId, providerLabel }) => {
      if (
        countRunningGenerations(get().generations) >= MAX_PARALLEL_GENERATIONS
      ) {
        return;
      }

      const projectName = projectNameFromPrompt(prompt);
      const windowId = openGenerationWindow(projectName);
      const generationRecord: ArtifactGeneration = {
        error: null,
        generationId: "",
        projectName,
        prompt,
        providerId,
        providerLabel,
        status: "running",
        windowId,
      };
      set((state) => ({
        generations: { ...state.generations, [windowId]: generationRecord },
      }));

      try {
        const startResponse = await window.electronAPI.generateArtifact(
          prompt,
          providerId
        );
        if (!startResponse.success) {
          settleGeneration(windowId, "error", startResponse.error);
          return;
        }
        const { generationId } = startResponse.data;

        // The window was closed before the run registered: cancel it and drop
        // the record so a stray process cannot linger.
        if (!useWindowStore.getState().windows[windowId]) {
          void ignoreFailure(window.electronAPI.cancelArtifact(generationId));
          get().forget(windowId);
          return;
        }

        set((state) => {
          const runningGeneration = state.generations[windowId];
          if (!runningGeneration) {
            return state;
          }
          return {
            generations: {
              ...state.generations,
              [windowId]: { ...runningGeneration, generationId },
            },
          };
        });

        // Cancel was clicked while the invoke was still in flight; now that the
        // id exists, tell main to terminate the process it just started.
        const patchedGeneration = get().generations[windowId];
        if (patchedGeneration?.status !== "running") {
          void ignoreFailure(window.electronAPI.cancelArtifact(generationId));
          return;
        }

        const unsubscribeProgress =
          window.electronAPI.setArtifactProgressHandler(
            generationId,
            (event) => {
              const currentGeneration = get().generations[windowId];
              if (
                !currentGeneration ||
                currentGeneration.generationId !== generationId
              ) {
                return;
              }
              if (event.type === "done") {
                dropProgressSubscription(windowId);
                showArtifactInWindow(
                  windowId,
                  createFilePreviewFromPath(
                    event.result.fileName,
                    event.result.path
                  ),
                  // The agent names the project; fall back to the prompt.
                  event.result.title ?? currentGeneration.projectName
                );
                get().forget(windowId);
              } else {
                settleGeneration(windowId, "error", event.message);
              }
            }
          );
        const currentGeneration = get().generations[windowId];
        if (currentGeneration?.status === "running") {
          progressUnsubscribes.set(windowId, unsubscribeProgress);
        } else {
          // A buffered done/error event may have finalized the run while the
          // subscribe call was replaying its backlog.
          unsubscribeProgress();
        }
      } catch (startError: unknown) {
        settleGeneration(
          windowId,
          "error",
          startError instanceof Error
            ? startError.message
            : "Generation could not start."
        );
      }
    },
  };
});
