import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

import type { IPCCommand } from "../../shared/contract.js";
import {
  IPCCommandSchema,
  PermissionRespondPayloadSchema,
  SettingsSavePayloadSchema,
} from "../schemas/ipc-schemas.js";
import { IPCError } from "../shared/errors/ipc-error.js";
import { Permissions } from "./permissions.js";
import { Persistence } from "./persistence.js";

type CommandServices = Permissions | Persistence;
type DecodableCommandInput = IPCCommand | IPCCommand["payload"];

export type CommandHandler = (
  payload: IPCCommand["payload"]
) => Effect.Effect<unknown, IPCError, CommandServices>;

export interface IPCRouter {
  readonly handleCommand: (
    command: IPCCommand
  ) => Effect.Effect<unknown, IPCError, CommandServices>;
  /** Bind a handler to a command type — the map lives in this layer. */
  readonly register: (
    type: IPCCommand["type"],
    handler: CommandHandler
  ) => Effect.Effect<void>;
}

export const IPCRouter = Context.GenericTag<IPCRouter>("IPCRouter");

/** Schema decode for command payloads at the handler boundary — no casts. */
export const decodeCommandPayload = <A>(
  schema: Schema.Schema<A>,
  value: DecodableCommandInput,
  command: string
): Effect.Effect<A, IPCError> =>
  Effect.try({
    catch: (cause) =>
      new IPCError({ cause, command, reason: "SchemaValidationFailed" }),
    try: () => Schema.decodeUnknownSync(schema)(value),
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

export const IPCRouterLive = Layer.sync(IPCRouter, () => {
  const handlers = new Map<string, CommandHandler>([
    // Built-in commands are part of the router's construction.
    ["permission:respond", permissionRespondHandler],
    ["settings:save", settingsSaveHandler],
  ]);

  return {
    handleCommand: (command: IPCCommand) =>
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

    register: (type: IPCCommand["type"], handler: CommandHandler) =>
      Effect.sync(() => {
        handlers.set(type, handler);
      }),
  };
});
