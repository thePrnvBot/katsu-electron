import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import { IPCCommand } from "../schemas/ipc-schemas.js";
import type { WindowMetadata } from "../shared/types.js";
import { IPCError } from "../shared/types.js";
import { getUserData, writeFileAtomic } from "../util.js";

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

const StateFilePath: string = getUserData("windows.json");

const SettingsFilePath: string = getUserData("settings.json");

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

const registerCommand = (type: string, handler: CommandHandler): void => {
  Effect.runSync(
    Effect.gen(function* registerCommandGen() {
      const router = yield* IPCRouter;
      return yield* router.registerHandler(type, handler);
    }).pipe(Effect.provide(IPCRouterLive))
  );
};

const stateSaveHandler: CommandHandler = (payload) =>
  Effect.gen(function* stateSaveHandlerGen() {
    const { windows } = payload as { windows: WindowMetadata[] };

    yield* writeFileAtomic(StateFilePath, JSON.stringify(windows, null, 2), {
      rename: (err) => new IPCError("CommandFailed", "state:save", err),
      write: (err) => new IPCError("CommandFailed", "state:save", err),
    });

    return { saved: windows.length };
  });

registerCommand("state:save", stateSaveHandler);

const settingsSaveHandler: CommandHandler = (payload) =>
  Effect.gen(function* settingsSaveHandlerGen() {
    const { settings } = payload as {
      settings: { windowPeeking: boolean };
    };

    yield* writeFileAtomic(
      SettingsFilePath,
      JSON.stringify(settings, null, 2),
      {
        rename: (err) => new IPCError("CommandFailed", "settings:save", err),
        write: (err) => new IPCError("CommandFailed", "settings:save", err),
      }
    );

    return { saved: true };
  });

registerCommand("settings:save", settingsSaveHandler);
