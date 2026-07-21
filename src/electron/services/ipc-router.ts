import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { IPCCommand } from "../../shared/contract.js";
import { IPCCommandSchema, SettingsSchema } from "../schemas/ipc-schemas.js";
import { IPCError } from "../shared/errors/ipc-error.js";
import { Permissions } from "./permissions.js";
import { Persistence } from "./persistence.js";

type CommandServices = Permissions | Persistence;

export type CommandHandler = (
  payload: unknown
) => Effect.Effect<unknown, IPCError, CommandServices>;

export interface IPCRouter {
  readonly handleCommand: (
    command: unknown
  ) => Effect.Effect<unknown, IPCError, CommandServices>;
}

export const IPCRouter = Context.GenericTag<IPCRouter>("IPCRouter");

const handlers = new Map<string, CommandHandler>();

/**
 * Synchronous registration — the handler map is a module singleton, so
 * there is no reason to route registration through the Effect runtime.
 */
export const registerCommandHandler = (
  type: IPCCommand["type"],
  handler: CommandHandler
): void => {
  handlers.set(type, handler);
};

/** Parse a payload at the handler boundary — no casts. */
export const decodeCommandPayload = <A, I>(
  schema: Schema.Schema<A, I>,
  value: unknown,
  command: string
): Effect.Effect<A, IPCError> =>
  Effect.try({
    catch: (cause) =>
      new IPCError({ cause, command, reason: "SchemaValidationFailed" }),
    try: () => Schema.decodeUnknownSync(schema)(value),
  });

export const IPCRouterLive = Layer.succeed(IPCRouter, {
  handleCommand: (command: unknown) =>
    Effect.gen(function* handleCommand() {
      const decoded = yield* decodeCommandPayload(
        IPCCommandSchema,
        command,
        "unknown"
      );

      const handler = handlers.get(decoded.type);
      if (!handler) {
        return yield* new IPCError({
          command: decoded.type,
          reason: "InvalidCommand",
        });
      }

      return yield* handler(decoded.payload);
    }),
});

// --- Built-in command handlers ---

const SettingsSavePayloadSchema = Schema.Struct({
  settings: SettingsSchema,
});

const settingsSaveHandler: CommandHandler = (payload) =>
  Effect.gen(function* settingsSave() {
    const { settings } = yield* decodeCommandPayload(
      SettingsSavePayloadSchema,
      payload,
      "settings:save"
    );
    const persistence = yield* Persistence;
    yield* persistence.saveSettings(settings).pipe(
      Effect.mapError(
        (cause) =>
          new IPCError({
            cause,
            command: "settings:save",
            reason: "CommandFailed",
          })
      )
    );
    return { saved: true };
  });

const PermissionRespondPayloadSchema = Schema.Struct({
  granted: Schema.Boolean,
  requestId: Schema.String,
});

const permissionRespondHandler: CommandHandler = (payload) =>
  Effect.gen(function* permissionRespond() {
    const { requestId, granted } = yield* decodeCommandPayload(
      PermissionRespondPayloadSchema,
      payload,
      "permission:respond"
    );
    const permissions = yield* Permissions;
    yield* permissions.respondToRequest(requestId, granted);
    return { responded: true };
  });

/** Called once from `registerIpcHandlers` — never at module import time. */
export const registerBuiltinCommandHandlers = (): void => {
  registerCommandHandler("settings:save", settingsSaveHandler);
  registerCommandHandler("permission:respond", permissionRespondHandler);
};
