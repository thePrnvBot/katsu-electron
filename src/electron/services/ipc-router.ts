import * as fs from "node:fs/promises";
import path from "node:path";

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { app } from "electron";

import { IPCCommand } from "../schemas/ipc-schemas.js";
import { IPCError } from "../shared/types.js";

type CommandHandler = (payload: unknown) => Effect.Effect<unknown, IPCError>;

export interface IPCRouter {
  readonly handleCommand: (
    command: unknown
  ) => Effect.Effect<unknown, IPCError>;
  readonly registerHandler: (
    type: string,
    handler: CommandHandler
  ) => Effect.Effect<void>;
}

export const IPCRouter = Context.GenericTag<IPCRouter>("IPCRouter");

const handlers = new Map<string, CommandHandler>();

const getStateFilePath = (): string =>
  path.join(app.getPath("userData"), "windows.json");

export const IPCRouterLive = Layer.succeed(IPCRouter, {
  handleCommand: (command: unknown) =>
    Effect.gen(function* handleCommand() {
      const decoded = yield* Effect.try({
        catch: () =>
          new IPCError("SchemaValidationFailed", JSON.stringify(command)),
        try: () => Schema.decodeUnknownSync(IPCCommand)(command),
      });

      const handler = handlers.get(decoded.type);
      if (handler) {
        return yield* handler(decoded.payload);
      }

      return { type: decoded.type } as unknown;
    }),

  registerHandler: (type: string, handler: CommandHandler) =>
    Effect.sync(() => {
      handlers.set(type, handler);
    }),
});

const stateSaveHandler: CommandHandler = (payload) =>
  Effect.gen(function* stateSaveHandlerGen() {
    const { windows } = payload as { windows: Record<string, unknown>[] };

    const filePath = getStateFilePath();
    const tmpPath = `${filePath}.tmp`;
    const content = JSON.stringify(windows, null, 2);

    yield* Effect.tryPromise({
      catch: (err) => new IPCError("CommandFailed", "state:save", err),
      try: () => fs.writeFile(tmpPath, content, "utf-8"),
    });

    yield* Effect.tryPromise({
      catch: (err) => new IPCError("CommandFailed", "state:save", err),
      try: () => fs.rename(tmpPath, filePath),
    });

    return { saved: windows.length };
  });

Effect.runSync(
  Effect.gen(function* registerStateSave() {
    const router = yield* IPCRouter;
    return yield* router.registerHandler("state:save", stateSaveHandler);
  }).pipe(Effect.provide(IPCRouterLive))
);
