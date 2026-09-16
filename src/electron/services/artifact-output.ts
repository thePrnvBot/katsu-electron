/**
 * Pure helpers for artifact generation: prompt shaping, provider invocation,
 * and artifact discovery. Kept free of Electron imports so they are unit
 * testable in isolation.
 */

import { Buffer } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";

import type { PreviewType } from "../../shared/contract.js";
import { PREVIEW_TYPE_BY_EXTENSION } from "../../shared/file-types.js";

export interface ArtifactInvocation {
  readonly command: string;
  readonly args: readonly string[];
  readonly environment?: Readonly<Record<string, string>>;
  /** True for the cmd.exe shim path — Node must not re-quote the line. */
  readonly windowsVerbatimArguments: boolean;
}

const MAX_DISCOVERY_DEPTH = 4;
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git"]);

/** Wrap the user request with the artifact contract the workspace expects. */
export const buildArtifactPrompt = (userPrompt: string): string =>
  [
    "Create a single self-contained HTML file for the request below.",
    "Write it to ./index.html in the current working directory.",
    "Give the page a short, descriptive <title> (2-5 words) naming the project.",
    "Use only inline CSS and inline JavaScript; do not load external resources.",
    "Do not use browser storage (localStorage, sessionStorage, IndexedDB); keep state in memory.",
    "Do not ask questions. Produce the file, then stop.",
    "",
    `Request: ${userPrompt}`,
  ].join("\n");

const TITLE_PATTERN = /<title\b[^>]*>(?<title>[\s\S]*?)<\/title>/iu;
const MAX_TITLE_LENGTH = 60;

const HTML_ENTITIES = new Map([
  ["&amp;", "&"],
  ["&apos;", "'"],
  ["&gt;", ">"],
  ["&lt;", "<"],
  ["&quot;", '"'],
]);

const decodeEntities = (textWithEntities: string): string => {
  let decodedText = textWithEntities;
  for (const [entity, character] of HTML_ENTITIES) {
    decodedText = decodedText.replaceAll(entity, character);
  }
  return decodedText;
};

/** The agent's own project title from `index.html`, normalized for a window. */
export const extractHtmlTitle = (html: string): string | null => {
  const rawTitle = TITLE_PATTERN.exec(html)?.groups?.title;
  if (rawTitle === undefined) {
    return null;
  }
  const cleanedTitle = decodeEntities(rawTitle).replaceAll(/\s+/gu, " ").trim();
  if (cleanedTitle.length === 0) {
    return null;
  }
  return cleanedTitle.length > MAX_TITLE_LENGTH
    ? `${cleanedTitle.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`
    : cleanedTitle;
};

/** Substitute the prompt and workspace dir into provider args verbatim. */
export const buildArtifactArgs = (
  argTemplate: readonly string[],
  prompt: string,
  workspaceDir: string
): string[] =>
  argTemplate.map((templateArg) => {
    if (templateArg === "{prompt}") {
      return prompt;
    }
    if (templateArg === "{dir}") {
      return workspaceDir;
    }
    return templateArg;
  });

const PROJECT_ENV_KEYS = new Set(["OLDPWD", "PWD"]);

/**
 * Environment for the agent process. `PWD`/`INIT_CWD` and npm's `npm_*`
 * variables are rewritten to the workspace: CLIs (notably opencode) resolve
 * their "project directory" from these rather than the process cwd, and a
 * stale value pointing at the host project would let the agent write outside
 * the sandbox. Provider auth (from the user's environment) is inherited.
 */
export const buildAgentEnv = (workspaceDir: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value === undefined ||
      PROJECT_ENV_KEYS.has(key) ||
      key.startsWith("npm_")
    ) {
      continue;
    }
    env[key] = value;
  }
  env.INIT_CWD = workspaceDir;
  env.PWD = workspaceDir;
  return env;
};

const WINDOWS_SHIM_SCRIPT =
  "$command = $env:KATSU_PROVIDER_COMMAND; $arguments = $env:KATSU_PROVIDER_ARGS | ConvertFrom-Json; & $command @arguments; exit $LASTEXITCODE";
const WINDOWS_SHIM_SCRIPT_BASE64 = Buffer.from(
  WINDOWS_SHIM_SCRIPT,
  "utf16le"
).toString("base64");

/**
 * `.cmd`/`.bat` shims cannot be spawned directly on Windows. Run them through
 * PowerShell with the command and argv serialized as environment data; this
 * avoids cmd.exe quote escaping and `%VAR%` expansion inside prompts.
 */
export const buildArtifactInvocation = (
  executable: string,
  args: readonly string[]
): ArtifactInvocation => {
  if (process.platform === "win32" && /\.(?:cmd|bat)$/iu.test(executable)) {
    return {
      args: [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        WINDOWS_SHIM_SCRIPT_BASE64,
      ],
      command: "powershell.exe",
      environment: {
        KATSU_PROVIDER_ARGS: JSON.stringify(args),
        KATSU_PROVIDER_COMMAND: executable,
      },
      windowsVerbatimArguments: false,
    };
  }
  return { args, command: executable, windowsVerbatimArguments: false };
};

/** Every plain file under `directoryPath`, ignoring dependency/VCS dirs. */
export const collectArtifactFiles = async (
  directoryPath: string,
  depth: number
): Promise<readonly string[]> => {
  if (depth > MAX_DISCOVERY_DEPTH) {
    return [];
  }
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name)
          ? []
          : await collectArtifactFiles(entryPath, depth + 1);
      }
      return entry.isFile() ? [entryPath] : [];
    })
  );
  return nestedFiles.flat();
};

const HTML_PATTERN = /\.html?$/iu;

/** Prefer the conventional entrypoint, then any HTML, then anything. */
export const pickArtifact = (files: readonly string[]): string | null => {
  const sortedFiles = files.toSorted((a, b) => a.localeCompare(b));
  const indexFile = sortedFiles.find(
    (file) => path.basename(file).toLowerCase() === "index.html"
  );
  return (
    indexFile ??
    sortedFiles.find((file) => HTML_PATTERN.test(file)) ??
    sortedFiles[0] ??
    null
  );
};

/** Map a produced file to the preview surface that can render it. */
export const classifyArtifact = (fileName: string): PreviewType => {
  const extension = path.extname(fileName).toLowerCase().slice(1);
  return PREVIEW_TYPE_BY_EXTENSION.get(extension) ?? "text";
};
