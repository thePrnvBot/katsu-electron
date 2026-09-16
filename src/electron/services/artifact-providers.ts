/** Built-in local agent CLIs that can generate artifacts on this machine. */

import fs from "node:fs";
import path from "node:path";

import type {
  ArtifactProviderId,
  ArtifactProviderSummary,
} from "../../shared/contract.js";

interface ArtifactProvider {
  readonly id: ArtifactProviderId;
  readonly label: string;
  readonly command: string;
  /**
   * Args passed verbatim. `{prompt}` is replaced with the prompt and `{dir}`
   * with the generation workspace. Both are passed as single argv entries —
   * never interpolated into a shell string.
   */
  readonly args: readonly string[];
}

/**
 * Local-first providers. Each CLI runs non-interactively and writes files
 * into `{dir}`, which the generation service points at a throwaway
 * workspace. `--dir` is passed explicitly because some CLIs resolve their
 * working directory from inherited env vars (`PWD`, `INIT_CWD`) rather than
 * the process cwd, which would otherwise leak writes into the host project.
 */
const PROVIDERS = [
  {
    args: ["run", "--dir", "{dir}", "{prompt}"],
    command: "opencode",
    id: "opencode",
    label: "OpenCode",
  },
  {
    args: ["-p", "{prompt}", "--permission-mode", "acceptEdits"],
    command: "claude",
    id: "claude",
    label: "Claude Code",
  },
  {
    args: [
      "exec",
      "--skip-git-repo-check",
      "--sandbox",
      "workspace-write",
      "{prompt}",
    ],
    command: "codex",
    id: "codex",
    label: "Codex",
  },
] as const satisfies readonly ArtifactProvider[];

const WINDOWS_EXTENSIONS: readonly string[] = [".exe", ".cmd", ".bat"];

/**
 * A full PATH scan stats every entry (times three extensions on Windows), so
 * results are cached briefly — menus and `!g` re-check the same commands.
 * The short TTL lets a CLI installed mid-session show up without a restart.
 */
const RESOLUTION_CACHE_TTL_MS = 30_000;

interface CachedResolution {
  readonly checkedAt: number;
  readonly executablePath: string | null;
}

const resolutionCache = new Map<string, CachedResolution>();

const isExecutableFile = (filePath: string): boolean => {
  try {
    if (!fs.statSync(filePath).isFile()) {
      return false;
    }
    if (process.platform !== "win32") {
      fs.accessSync(filePath, fs.constants.X_OK);
    }
    return true;
  } catch {
    return false;
  }
};

/** PATH entries are occasionally quoted (e.g. `"C:\Program Files\x"`). */
const unquotePathDirectory = (pathDirectory: string): string => {
  const trimmed = pathDirectory.trim();
  return trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1)
    : trimmed;
};

const resolveExecutableUncached = (command: string): string | null => {
  if (command.includes("/") || command.includes("\\")) {
    return isExecutableFile(command) ? command : null;
  }

  const executableExtensions =
    process.platform === "win32" ? WINDOWS_EXTENSIONS : [""];
  for (const rawDirectory of (process.env.PATH ?? "").split(path.delimiter)) {
    const pathDirectory = unquotePathDirectory(rawDirectory);
    if (pathDirectory.length === 0) {
      continue;
    }
    for (const extension of executableExtensions) {
      const executablePath = path.join(pathDirectory, `${command}${extension}`);
      if (isExecutableFile(executablePath)) {
        return executablePath;
      }
    }
  }
  return null;
};

/** Resolve a bare command against PATH; null when nothing executable matches. */
export const resolveExecutable = (command: string): string | null => {
  const now = Date.now();
  const cached = resolutionCache.get(command);
  if (cached && now - cached.checkedAt < RESOLUTION_CACHE_TTL_MS) {
    return cached.executablePath;
  }
  const executablePath = resolveExecutableUncached(command);
  resolutionCache.set(command, { checkedAt: now, executablePath });
  return executablePath;
};

export const getProvider = (id: ArtifactProviderId): ArtifactProvider | null =>
  PROVIDERS.find((provider) => provider.id === id) ?? null;

export const listProviders = (): ArtifactProviderSummary[] =>
  PROVIDERS.map((provider) => ({
    available: resolveExecutable(provider.command) !== null,
    id: provider.id,
    label: provider.label,
  }));
