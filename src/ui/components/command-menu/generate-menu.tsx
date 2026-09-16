/** Palette page: prompt a local agent to generate a sandboxed artifact. */

import { useEffect, useState } from "react";

import { MAX_ARTIFACT_PROMPT_LENGTH } from "../../../shared/contract";
import type {
  ArtifactProviderId,
  ArtifactProviderSummary,
} from "../../../shared/contract";
import {
  countRunningGenerations,
  MAX_PARALLEL_GENERATIONS,
  useArtifactStore,
} from "../../store/artifact-store";
import { useSettingsStore } from "../../store/settings-store";
import { ProviderSelect } from "../provider-select";
import type { CloseProps } from "./command-menu";

export const GenerateMenu = ({ closeAndResetMenu }: CloseProps) => {
  const settings = useSettingsStore((s) => s.settings);
  const setArtifactProvider = useSettingsStore((s) => s.setArtifactProvider);
  const start = useArtifactStore((s) => s.start);
  const [providers, setProviders] = useState<ArtifactProviderSummary[]>([]);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [providerId, setProviderId] = useState<ArtifactProviderId>(
    settings.artifactProviderId
  );

  useEffect(() => {
    let cancelled = false;
    const loadProviders = async (): Promise<void> => {
      try {
        const list = await window.electronAPI.listArtifactProviders();
        if (!cancelled) {
          setProviders(list);
        }
      } catch {
        // Without the list every provider looks unavailable; say why.
        if (!cancelled) {
          setProvidersError("Could not check installed provider CLIs.");
        }
      }
    };
    void loadProviders();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = providers.find((provider) => provider.id === providerId);
  const runningCount = useArtifactStore((s) =>
    countRunningGenerations(s.generations)
  );
  const atCapacity = runningCount >= MAX_PARALLEL_GENERATIONS;
  const canGenerate =
    prompt.trim().length > 0 && selected?.available === true && !atCapacity;

  let hint = "Runs locally in an isolated workspace.";
  if (providersError !== null) {
    hint = providersError;
  }
  if (selected && !selected.available) {
    hint = "Install the selected provider CLI to generate.";
  }
  if (atCapacity) {
    hint = `Up to ${MAX_PARALLEL_GENERATIONS} generations run at once.`;
  }

  const submit = () => {
    if (!canGenerate || !selected) {
      return;
    }
    setArtifactProvider(providerId);
    void start({
      prompt: prompt.trim(),
      providerId,
      providerLabel: selected.label,
    });
    closeAndResetMenu();
  };

  return (
    <div className="flex flex-col gap-3 px-1 pb-1">
      <div className="flex items-stretch gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-white/50">
          Prompt
          <textarea
            autoFocus
            maxLength={MAX_ARTIFACT_PROMPT_LENGTH}
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              // Keep palette navigation keys inside the prompt box; Escape
              // falls through so the palette can still go back or close.
              if (e.key !== "Escape") {
                e.stopPropagation();
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Describe the artifact to generate…"
            className="h-24 resize-none rounded-lg border border-white/5 bg-[#2a2a2a] px-3 py-2 text-sm text-[#eee] placeholder-white/35 outline-none transition focus:border-white/15"
          />
        </label>

        <div className="flex w-1/6 min-w-0 shrink-0 flex-col gap-1 text-xs text-white/50">
          <span>Provider</span>
          <ProviderSelect
            onChange={setProviderId}
            providers={providers}
            value={providerId}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-white/40">{hint}</span>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={submit}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Generate
        </button>
      </div>
    </div>
  );
};
