import * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { IPCCommand } from "../schemas/IPCSchemas.js";
import { IPCError } from "../shared/types.js";
import { app } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";

type CommandHandler = (payload: unknown) => Effect.Effect<unknown, IPCError>;

export interface IPCRouter {
  readonly handleCommand: (command: unknown) => Effect.Effect<unknown, IPCError>;
  readonly registerHandler: (
    type: string,
    handler: CommandHandler
  ) => Effect.Effect<void>;
}

export const IPCRouter = Context.GenericTag<IPCRouter>("IPCRouter");

const handlers = new Map<string, CommandHandler>();

function getStateFilePath(): string {
  return path.join(app.getPath("userData"), "windows.json");
}

export const IPCRouterLive = Layer.succeed(IPCRouter, {
  handleCommand: (command: unknown) =>
    Effect.gen(function* () {
      const decoded = yield* Effect.try({
        try: () => Schema.decodeUnknownSync(IPCCommand)(command),
        catch: () =>
          new IPCError("SchemaValidationFailed", JSON.stringify(command)),
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
  Effect.gen(function* () {
    const { windows } = payload as { windows: Array<Record<string, unknown>> };

    const filePath = getStateFilePath();
    const tmpPath = filePath + ".tmp";
    const content = JSON.stringify(windows, null, 2);

    yield* Effect.tryPromise({
      try: () => fs.writeFile(tmpPath, content, "utf-8"),
      catch: (err) => new IPCError("CommandFailed", "state:save", err),
    });

    yield* Effect.tryPromise({
      try: () => fs.rename(tmpPath, filePath),
      catch: (err) => new IPCError("CommandFailed", "state:save", err),
    });

    return { saved: windows.length };
  });

Effect.runSync(
  Effect.gen(function* () {
    const router = yield* IPCRouter;
    return yield* router.registerHandler("state:save", stateSaveHandler);
  }).pipe(Effect.provide(IPCRouterLive))
);
