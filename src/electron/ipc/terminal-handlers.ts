import * as Effect from "effect/Effect";
import { ipcMain } from "electron";

import type {
  TerminalResizePayload,
  TerminalSpawnOptions,
  TerminalWritePayload,
} from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { mainRuntime } from "../runtime.js";
import {
  TerminalIdSchema,
  TerminalResizePayloadSchema,
  TerminalSpawnOptionsSchema,
  TerminalWritePayloadSchema,
} from "../schemas/ipc-schemas.js";
import { TerminalService } from "../services/terminal.js";
import { assertMainWindowSender, decodePayload } from "./guards.js";

export const registerTerminalHandlers = (): void => {
  // Terminal: spawn a new PTY session, returns its id.
  ipcMain.handle(
    IpcChannel.terminalSpawn,
    async (event, options: TerminalSpawnOptions) => {
      assertMainWindowSender(event);
      return await mainRuntime.runPromise(
        Effect.gen(function* spawnTerminal() {
          const parsed = yield* decodePayload(
            TerminalSpawnOptionsSchema,
            options,
            "invalid terminal spawn options"
          );
          const terminals = yield* TerminalService;
          return yield* terminals.spawn(parsed);
        })
      );
    }
  );

  // Terminal: write input into a PTY session.
  ipcMain.handle(
    IpcChannel.terminalWrite,
    async (event, payload: TerminalWritePayload) => {
      assertMainWindowSender(event);
      await mainRuntime.runPromise(
        Effect.gen(function* writeTerminal() {
          const parsed = yield* decodePayload(
            TerminalWritePayloadSchema,
            payload,
            "invalid terminal write payload"
          );
          const terminals = yield* TerminalService;
          yield* terminals.write(parsed.id, parsed.data);
        })
      );
    }
  );

  // Terminal: resize a PTY session to match the renderer's fit-addon dims.
  ipcMain.handle(
    IpcChannel.terminalResize,
    async (event, payload: TerminalResizePayload) => {
      assertMainWindowSender(event);
      await mainRuntime.runPromise(
        Effect.gen(function* resizeTerminal() {
          const parsed = yield* decodePayload(
            TerminalResizePayloadSchema,
            payload,
            "invalid terminal resize payload"
          );
          const terminals = yield* TerminalService;
          yield* terminals.resize(parsed.id, parsed.cols, parsed.rows);
        })
      );
    }
  );

  // Terminal: kill a PTY session (window close / unmount).
  ipcMain.handle(IpcChannel.terminalKill, async (event, id: string) => {
    assertMainWindowSender(event);
    await mainRuntime.runPromise(
      Effect.gen(function* killTerminal() {
        const parsed = yield* decodePayload(
          TerminalIdSchema,
          id,
          "invalid terminal id"
        );
        const terminals = yield* TerminalService;
        yield* terminals.kill(parsed);
      })
    );
  });
};
