/**
 * Sandboxed artifact generation.
 *
 * Each generation runs a user-selected local agent CLI in a throwaway
 * workspace directory with no shell on the host: the process sees only that
 * workspace as its working directory and it is killed on a wall-clock timeout.
 * The agent never receives a grant to read or write anywhere else — the
 * sandbox boundary here is the workspace plus the curated provider command,
 * not a VM. VM-level isolation (Rivet AgentOS) is a future backend for
 * platforms it supports.
 */

import { Buffer } from "node:buffer";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import type {
  ArtifactProgressEvent,
  ArtifactProviderId,
  ArtifactResultPayload,
  PreviewType,
} from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { ArtifactGenerationError } from "../shared/errors/artifact-generation-error.js";
import {
  getArtifactWorkspacesDir,
  getDropsDir,
  sanitizeTempFileName,
} from "../util.js";
import { getMainWindow } from "../window-manager.js";
import {
  buildAgentEnv,
  buildArtifactArgs,
  buildArtifactInvocation,
  buildArtifactPrompt,
  classifyArtifact,
  collectArtifactFiles,
  extractHtmlTitle,
  pickArtifact,
} from "./artifact-output.js";
import { getProvider, resolveExecutable } from "./artifact-providers.js";

const GENERATION_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
/** Only the document head is needed to read the agent's <title>. */
const TITLE_SNIFF_BYTES = 256 * 1024;

export interface ArtifactGenerationService {
  readonly start: (request: {
    readonly prompt: string;
    readonly providerId: ArtifactProviderId;
  }) => Effect.Effect<
    { readonly generationId: string },
    ArtifactGenerationError
  >;
  /** Cancel a run. Termination is best effort — the 5-minute cap backstops. */
  readonly cancel: (
    generationId: string
  ) => Effect.Effect<void, ArtifactGenerationError>;
  /** Kill every running generation — called once from the app quit flow. */
  readonly killAll: () => Effect.Effect<void, ArtifactGenerationError>;
}

export const ArtifactGenerationService =
  Context.GenericTag<ArtifactGenerationService>("ArtifactGenerationService");

/**
 * Lifecycle phase. `Stopped` is terminal, so a generation can never be
 * finalized twice no matter how its process events interleave.
 */
type GenerationPhase =
  | { readonly _tag: "Running" }
  | { readonly _tag: "TimingOut" }
  | { readonly _tag: "Stopped" };

interface ActiveGeneration {
  readonly agentProcess: ChildProcess;
  readonly providerLabel: string;
  readonly workspaceDir: string;
  phase: GenerationPhase;
}

const sendProgressEvent = (
  generationId: string,
  event: ArtifactProgressEvent
): void => {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IpcChannel.artifactProgress, {
      event,
      generationId,
    });
  }
};

const removeDirectoryQuietly = async (directoryPath: string): Promise<void> => {
  try {
    await fs.rm(directoryPath, { force: true, recursive: true });
  } catch {
    // Cleanup failures are non-fatal — the OS temp sweep gets stragglers.
  }
};

/**
 * `taskkill /T` can fail when the root already exited but detached descendants
 * survive, so this fallback walks `ParentProcessId` links and stops whatever
 * remains. PowerShell is only spawned on cleanup, so its startup cost is not
 * on any hot path.
 */
const WINDOWS_SWEEP_SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$rootPid = [int]$env:KATSU_KILL_PID",
  "$processes = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId)",
  "$targets = New-Object System.Collections.Generic.List[int]",
  "$level = @($rootPid)",
  "while ($level.Count -gt 0) {",
  "  $next = New-Object System.Collections.Generic.List[int]",
  "  foreach ($parentId in $level) {",
  "    foreach ($process in $processes) {",
  "      if ($process.ParentProcessId -eq $parentId) {",
  "        $targets.Add([int]$process.ProcessId)",
  "        $next.Add([int]$process.ProcessId)",
  "      }",
  "    }",
  "  }",
  "  $level = $next.ToArray()",
  "}",
  "foreach ($target in $targets) { Stop-Process -Id $target -Force }",
  "Stop-Process -Id $rootPid -Force",
].join("\n");

const WINDOWS_SWEEP_SCRIPT_BASE64 = Buffer.from(
  WINDOWS_SWEEP_SCRIPT,
  "utf16le"
).toString("base64");

const sweepWindowsDescendants = (rootPid: number): Promise<void> =>
  // eslint-disable-next-line promise/avoid-new -- child_process completion is callback-based
  new Promise((resolve) => {
    const sweep = spawn(
      "powershell.exe",
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        WINDOWS_SWEEP_SCRIPT_BASE64,
      ],
      {
        env: { ...process.env, KATSU_KILL_PID: String(rootPid) },
        stdio: "ignore",
        windowsHide: true,
      }
    );
    sweep.once("close", () => resolve());
    sweep.once("error", () => resolve());
  });

/** Terminate the provider and its descendants, including Windows cmd shims. */
const terminateProcessTree = async (
  agentProcess: ChildProcess
): Promise<void> => {
  const { pid } = agentProcess;
  if (pid === undefined) {
    agentProcess.kill();
    return;
  }
  if (process.platform !== "win32") {
    // The child is spawned detached, so its pid doubles as a process-group
    // id; the negated pid signals the provider CLI and all its descendants.
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      agentProcess.kill("SIGKILL");
    }
    return;
  }

  // eslint-disable-next-line promise/avoid-new -- child_process completion is callback-based
  const killedByTaskkill = await new Promise<boolean>((resolve) => {
    const taskKill = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    taskKill.once("close", (exitCode) => resolve(exitCode === 0));
    taskKill.once("error", () => resolve(false));
  });
  if (killedByTaskkill) {
    return;
  }
  // taskkill failed (e.g. access denied or root already exited): kill the
  // root directly, then sweep any surviving descendants so the agent cannot
  // outlive its cleanup.
  agentProcess.kill("SIGKILL");
  await sweepWindowsDescendants(pid);
};

const shuttingDownError = (
  providerId: ArtifactProviderId
): ArtifactGenerationError =>
  new ArtifactGenerationError({
    message: "The application is closing.",
    providerId,
    reason: "ShuttingDown",
  });

const terminationError = (cause: unknown): ArtifactGenerationError =>
  new ArtifactGenerationError({
    cause,
    message: "The generation could not be stopped.",
    reason: "TerminationFailed",
  });

/** Read just the head of a staged HTML file to recover its <title>. */
const readArtifactTitle = async (
  artifactPath: string,
  previewType: PreviewType
): Promise<string | null> => {
  if (previewType !== "html") {
    return null;
  }
  const fileHandle = await fs.open(artifactPath, "r");
  try {
    const headBuffer = Buffer.alloc(TITLE_SNIFF_BYTES);
    const { bytesRead } = await fileHandle.read(
      headBuffer,
      0,
      TITLE_SNIFF_BYTES,
      0
    );
    return extractHtmlTitle(
      headBuffer.subarray(0, bytesRead).toString("utf-8")
    );
  } finally {
    await fileHandle.close();
  }
};

/** Copy the generated file into the served drops dir and describe it. */
const stageArtifact = async (
  workspaceDir: string
): Promise<ArtifactResultPayload> => {
  const workspaceFiles = await collectArtifactFiles(workspaceDir, 0);
  const artifactPath = pickArtifact(workspaceFiles);
  if (!artifactPath) {
    throw new ArtifactGenerationError({
      message: "The agent did not produce a file.",
      reason: "ArtifactMissing",
    });
  }

  const artifactStats = await fs.stat(artifactPath);
  if (artifactStats.size > MAX_ARTIFACT_BYTES) {
    throw new ArtifactGenerationError({
      message: "The generated file is larger than the 64 MB limit.",
      reason: "ArtifactTooLarge",
    });
  }

  const dropsDir = getDropsDir();
  await fs.mkdir(dropsDir, { recursive: true });
  const artifactFileName = path.basename(artifactPath);
  const stagedPath = path.join(
    dropsDir,
    `${crypto.randomUUID()}-${sanitizeTempFileName(artifactFileName)}`
  );
  await fs.copyFile(artifactPath, stagedPath);

  const previewType = classifyArtifact(artifactFileName);
  const title = await readArtifactTitle(stagedPath, previewType);
  return {
    fileName: artifactFileName,
    path: stagedPath,
    title: title ?? undefined,
  };
};

export const ArtifactGenerationServiceLive = Layer.sync(
  ArtifactGenerationService,
  () => {
    const activeGenerations = new Map<string, ActiveGeneration>();
    /** Starts that have not spawned yet; `killAll` drains them before exit. */
    const pendingStarts = new Set<Promise<unknown>>();
    let shuttingDown = false;

    const waitForPendingStarts = async (): Promise<void> => {
      await Promise.allSettled(pendingStarts);
    };

    const runPendingStart = async <Result>(
      operation: () => Promise<Result>
    ): Promise<Result> => {
      const startPromise = operation();
      pendingStarts.add(startPromise);
      try {
        return await startPromise;
      } finally {
        pendingStarts.delete(startPromise);
      }
    };

    const cleanupGeneration = async (
      generationId: string,
      activeGeneration: ActiveGeneration
    ): Promise<void> => {
      activeGenerations.delete(generationId);
      await removeDirectoryQuietly(activeGeneration.workspaceDir);
    };

    /** Terminate a generation's process tree and clean up its workspace. */
    const stopGeneration = async (
      generationId: string,
      activeGeneration: ActiveGeneration
    ): Promise<void> => {
      if (activeGeneration.phase._tag === "Stopped") {
        return;
      }
      activeGeneration.phase = { _tag: "Stopped" };
      await terminateProcessTree(activeGeneration.agentProcess);
      await cleanupGeneration(generationId, activeGeneration);
    };

    const finalizeGeneration = async (
      generationId: string,
      activeGeneration: ActiveGeneration,
      outcome:
        | { readonly type: "done" }
        | { readonly type: "error"; readonly message: string }
    ): Promise<void> => {
      if (activeGeneration.phase._tag === "Stopped") {
        return;
      }
      activeGeneration.phase = { _tag: "Stopped" };

      if (outcome.type === "error") {
        await cleanupGeneration(generationId, activeGeneration);
        sendProgressEvent(generationId, {
          message: outcome.message,
          type: "error",
        });
        return;
      }

      try {
        const artifactResult = await stageArtifact(
          activeGeneration.workspaceDir
        );
        await cleanupGeneration(generationId, activeGeneration);
        sendProgressEvent(generationId, {
          result: artifactResult,
          type: "done",
        });
      } catch (stageError: unknown) {
        await cleanupGeneration(generationId, activeGeneration);
        sendProgressEvent(generationId, {
          message:
            stageError instanceof Error && stageError.message.length > 0
              ? stageError.message
              : "The agent produced no artifact.",
          type: "error",
        });
      }
    };

    const start: ArtifactGenerationService["start"] = (request) =>
      Effect.tryPromise({
        catch: (cause) =>
          cause instanceof ArtifactGenerationError
            ? cause
            : new ArtifactGenerationError({
                cause,
                message:
                  cause instanceof Error
                    ? cause.message
                    : "The agent failed to start.",
                providerId: request.providerId,
                reason: "SpawnFailed",
              }),
        try: () =>
          runPendingStart(async () => {
            if (shuttingDown) {
              throw shuttingDownError(request.providerId);
            }
            const provider = getProvider(request.providerId);
            if (!provider) {
              throw new ArtifactGenerationError({
                message: "That provider is not supported.",
                providerId: request.providerId,
                reason: "ProviderNotFound",
              });
            }
            const executablePath = resolveExecutable(provider.command);
            if (!executablePath) {
              throw new ArtifactGenerationError({
                message: "That provider is not installed or not on PATH.",
                providerId: request.providerId,
                reason: "ProviderUnavailable",
              });
            }

            const generationId = crypto.randomUUID();
            const workspaceDir = path.join(
              getArtifactWorkspacesDir(),
              generationId
            );
            await fs.mkdir(workspaceDir, { recursive: true });
            if (shuttingDown) {
              await removeDirectoryQuietly(workspaceDir);
              throw shuttingDownError(request.providerId);
            }

            const providerInvocation = buildArtifactInvocation(
              executablePath,
              buildArtifactArgs(
                provider.args,
                buildArtifactPrompt(request.prompt),
                workspaceDir
              )
            );
            const agentProcess = spawn(
              providerInvocation.command,
              [...providerInvocation.args],
              {
                cwd: workspaceDir,
                detached: process.platform !== "win32",
                env: {
                  ...buildAgentEnv(workspaceDir),
                  ...providerInvocation.environment,
                },
                // No consumer for agent output: leave the pipes unpiped so a
                // chatty CLI cannot block on a full buffer until timeout.
                stdio: ["ignore", "ignore", "ignore"],
                windowsHide: true,
                windowsVerbatimArguments:
                  providerInvocation.windowsVerbatimArguments,
              }
            );

            const activeGeneration: ActiveGeneration = {
              agentProcess,
              phase: { _tag: "Running" },
              providerLabel: provider.label,
              workspaceDir,
            };
            activeGenerations.set(generationId, activeGeneration);

            const timeoutHandle = setTimeout(() => {
              if (activeGeneration.phase._tag !== "Running") {
                return;
              }
              activeGeneration.phase = { _tag: "TimingOut" };
              void terminateProcessTree(agentProcess);
            }, GENERATION_TIMEOUT_MS);
            timeoutHandle.unref();

            agentProcess.on("error", (cause) => {
              clearTimeout(timeoutHandle);
              void finalizeGeneration(generationId, activeGeneration, {
                message:
                  cause instanceof Error
                    ? cause.message
                    : "Agent failed to start.",
                type: "error",
              });
            });

            agentProcess.on("close", (exitCode) => {
              clearTimeout(timeoutHandle);
              if (activeGeneration.phase._tag === "Stopped") {
                return;
              }
              if (activeGeneration.phase._tag === "TimingOut") {
                void finalizeGeneration(generationId, activeGeneration, {
                  message: "Generation timed out.",
                  type: "error",
                });
                return;
              }
              if (exitCode === 0) {
                void finalizeGeneration(generationId, activeGeneration, {
                  type: "done",
                });
                return;
              }
              void finalizeGeneration(generationId, activeGeneration, {
                message: `Agent exited with code ${exitCode ?? "unknown"}.`,
                type: "error",
              });
            });

            return { generationId };
          }),
      });

    const cancel: ArtifactGenerationService["cancel"] = (generationId) =>
      Effect.tryPromise({
        catch: terminationError,
        try: async () => {
          const activeGeneration = activeGenerations.get(generationId);
          if (!activeGeneration) {
            return;
          }
          await stopGeneration(generationId, activeGeneration);
        },
      });

    const killAll: ArtifactGenerationService["killAll"] = () =>
      Effect.tryPromise({
        catch: terminationError,
        try: async () => {
          shuttingDown = true;
          await waitForPendingStarts();
          await Promise.all(
            [...activeGenerations.entries()].map(
              ([generationId, activeGeneration]) =>
                stopGeneration(generationId, activeGeneration)
            )
          );
        },
      });

    return { cancel, killAll, start };
  }
);
