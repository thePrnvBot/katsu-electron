/** PTY session management: spawn, batched IO relay to the renderer, resize, kill. */

import crypto from "node:crypto";
import os from "node:os";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as pty from "node-pty";

import type {
  TerminalDataPayload,
  TerminalExitPayload,
  TerminalSpawnOptions,
} from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { TerminalError } from "../shared/errors/terminal-error.js";
import { getMainWindow } from "../window-manager.js";

const DEFAULT_SHELL_WIN32 = "powershell.exe";
const DEFAULT_SHELL_POSIX = "/bin/bash";

const resolveShell = (): string => {
  if (os.platform() === "win32") {
    return process.env.COMSPEC ?? DEFAULT_SHELL_WIN32;
  }
  return process.env.SHELL ?? DEFAULT_SHELL_POSIX;
};

/** Kill a PTY; Windows ConPTY can throw on an already-dead handle. */
const killSession = (session: pty.IPty): void => {
  try {
    session.kill();
  } catch {
    // Already dead — nothing to do.
  }
};

interface OutputBatcher {
  flushNow: () => void;
  push: (chunk: string) => void;
}

/**
 * Batch PTY output into ~16ms frames: a chatty process (`cat` a large file)
 * emits an `onData` per chunk, and one IPC send per chunk floods the
 * renderer. Batches over the byte cap flush immediately to bound latency.
 */
const makeOutputBatcher = (flush: (data: string) => void): OutputBatcher => {
  const FLUSH_MS = 16;
  const MAX_BATCH_BYTES = 64 * 1024;
  let buffer = "";
  let timer: NodeJS.Timeout | null = null;

  const flushNow = (): void => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffer.length > 0) {
      const data = buffer;
      buffer = "";
      flush(data);
    }
  };

  return {
    flushNow,
    push: (chunk: string) => {
      buffer += chunk;
      if (buffer.length >= MAX_BATCH_BYTES) {
        flushNow();
        return;
      }
      timer ??= setTimeout(flushNow, FLUSH_MS);
    },
  };
};

/** Push a PTY event to the renderer — a no-op once the window is gone. */
type TerminalEventPayload = TerminalDataPayload | TerminalExitPayload;

const sendToMainWindow = (
  channel: string,
  payload: TerminalEventPayload
): void => {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
};

export interface TerminalService {
  readonly spawn: (
    options: TerminalSpawnOptions
  ) => Effect.Effect<{ id: string }, TerminalError>;
  readonly write: (
    id: string,
    data: string
  ) => Effect.Effect<void, TerminalError>;
  readonly resize: (
    id: string,
    cols: number,
    rows: number
  ) => Effect.Effect<void, TerminalError>;
  readonly kill: (id: string) => Effect.Effect<void>;
  /** Kills every live PTY — called once from the app quit flow. */
  readonly killAll: () => Effect.Effect<void>;
}

export const TerminalService =
  Context.GenericTag<TerminalService>("TerminalService");

export const TerminalServiceLive = Layer.sync(TerminalService, () => {
  const sessions = new Map<string, pty.IPty>();

  const requireSession = (
    id: string
  ): Effect.Effect<pty.IPty, TerminalError> => {
    const session = sessions.get(id);
    if (!session) {
      return Effect.fail(
        new TerminalError({ reason: "UnknownTerminal", terminalId: id })
      );
    }
    return Effect.succeed(session);
  };

  const spawn: TerminalService["spawn"] = (options) =>
    Effect.try({
      catch: (cause) => new TerminalError({ cause, reason: "SpawnFailed" }),
      try: () => {
        const id = crypto.randomUUID();
        const shell = resolveShell();
        const env = Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined
          )
        );
        const session = pty.spawn(shell, [], {
          cols: options.cols,
          cwd: options.cwd ?? os.homedir(),
          env,
          name: "xterm-256color",
          rows: options.rows,
        });

        const outputBatcher = makeOutputBatcher((data) => {
          sendToMainWindow(IpcChannel.terminalData, { data, id });
        });
        session.onData(outputBatcher.push);
        session.onExit(({ exitCode }) => {
          sessions.delete(id);
          // Flush the pending batch first so trailing output lands before
          // the exit event, then report the exit.
          outputBatcher.flushNow();
          sendToMainWindow(IpcChannel.terminalExit, { exitCode, id });
        });

        sessions.set(id, session);
        return { id };
      },
    });

  const write: TerminalService["write"] = (id, data) =>
    requireSession(id).pipe(
      Effect.flatMap((session) =>
        Effect.try({
          catch: (cause) =>
            new TerminalError({ cause, reason: "WriteFailed", terminalId: id }),
          try: () => session.write(data),
        })
      )
    );

  const resize: TerminalService["resize"] = (id, cols, rows) =>
    requireSession(id).pipe(
      Effect.flatMap((session) =>
        Effect.try({
          catch: (cause) =>
            new TerminalError({
              cause,
              reason: "ResizeFailed",
              terminalId: id,
            }),
          try: () => session.resize(cols, rows),
        })
      )
    );

  const kill: TerminalService["kill"] = (id) =>
    Effect.sync(() => {
      const session = sessions.get(id);
      if (session) {
        killSession(session);
        sessions.delete(id);
      }
    });

  const killAll: TerminalService["killAll"] = () =>
    Effect.sync(() => {
      for (const session of sessions.values()) {
        killSession(session);
      }
      sessions.clear();
    });

  return { kill, killAll, resize, spawn, write };
});
