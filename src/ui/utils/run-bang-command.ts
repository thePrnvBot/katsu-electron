/** Executes a parsed bang command against the app stores (command palette). */

import { MAX_ARTIFACT_PROMPT_LENGTH } from "../../shared/contract";
import {
  countRunningGenerations,
  MAX_PARALLEL_GENERATIONS,
  useArtifactStore,
} from "../store/artifact-store";
import { useCommandMenuStore } from "../store/command-menu-store";
import { useSettingsStore } from "../store/settings-store";
import { useWindowStore } from "../store/window-store";
import type { BangCommand } from "./bang-command";
import { openTerminalWindow } from "./open-preview-window";

export interface BangOutcome {
  /** True when the caller's palette should close after running. */
  readonly close: boolean;
  /** User-facing failure text, if any. */
  readonly message: string | null;
}

const GENERATION_CAPACITY_MESSAGE = `Up to ${MAX_PARALLEL_GENERATIONS} generations can run at once.`;

const atGenerationCapacity = (): boolean =>
  countRunningGenerations(useArtifactStore.getState().generations) >=
  MAX_PARALLEL_GENERATIONS;

/** Runs a bang command typed into the command palette. */
export const executeBangCommand = async (
  command: BangCommand
): Promise<BangOutcome> => {
  const commandMenu = useCommandMenuStore.getState();

  switch (command.kind) {
    case "window-layout": {
      const { activeWindowId, setWindowLayout } = useWindowStore.getState();
      if (command.layout === null || !activeWindowId) {
        commandMenu.openAt("layout");
        return { close: false, message: null };
      }
      setWindowLayout(activeWindowId, command.layout);
      return { close: true, message: null };
    }
    case "search": {
      commandMenu.openAt("windows", command.query);
      return { close: false, message: null };
    }
    case "workspace": {
      commandMenu.openAt("workspace", command.query);
      return { close: false, message: null };
    }
    case "terminal": {
      openTerminalWindow();
      return { close: true, message: null };
    }
    case "close-all": {
      useWindowStore.getState().closeAllWindows();
      return { close: true, message: null };
    }
    case "generate": {
      if (command.prompt.length === 0) {
        commandMenu.openAt("generate");
        return { close: false, message: null };
      }
      if (command.prompt.length > MAX_ARTIFACT_PROMPT_LENGTH) {
        return {
          close: false,
          message: `Prompts are limited to ${MAX_ARTIFACT_PROMPT_LENGTH} characters.`,
        };
      }
      if (atGenerationCapacity()) {
        return { close: false, message: GENERATION_CAPACITY_MESSAGE };
      }
      const providerId =
        useSettingsStore.getState().settings.artifactProviderId;
      const providers = await window.electronAPI.listArtifactProviders();
      const selectedProvider = providers.find(
        (provider) => provider.id === providerId
      );
      if (selectedProvider?.available !== true) {
        return {
          close: false,
          message: `Install ${selectedProvider?.label ?? providerId} to generate.`,
        };
      }
      // A run can start while the provider list loads; re-check so the store's
      // own capacity guard cannot silently drop this one.
      if (atGenerationCapacity()) {
        return { close: false, message: GENERATION_CAPACITY_MESSAGE };
      }
      await useArtifactStore.getState().start({
        prompt: command.prompt,
        providerId,
        providerLabel: selectedProvider.label,
      });
      return { close: true, message: null };
    }
    case "unknown": {
      return {
        close: false,
        message: `Unknown command: !${command.token}`,
      };
    }
    default: {
      return { close: false, message: null };
    }
  }
};
