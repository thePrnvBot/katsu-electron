import * as Schema from "effect/Schema";

export const BoundsSchema = Schema.Struct({
  height: Schema.Number.pipe(Schema.positive()),
  width: Schema.Number.pipe(Schema.positive()),
  x: Schema.Number,
  y: Schema.Number,
});

export const WindowMetadataSchema = Schema.Struct({
  bounds: BoundsSchema,
  id: Schema.String,
  title: Schema.optional(Schema.String),
  url: Schema.String,
  zIndex: Schema.Number.pipe(Schema.int()),
});

export const DialogOpenFileCommand = Schema.Struct({
  payload: Schema.Struct({}),
  type: Schema.Literal("dialog:openFile"),
});

export const StateLoadCommand = Schema.Struct({
  payload: Schema.Struct({}),
  type: Schema.Literal("state:load"),
});

export const StateSaveCommand = Schema.Struct({
  payload: Schema.Struct({
    windows: Schema.Array(WindowMetadataSchema),
  }),
  type: Schema.Literal("state:save"),
});

export const SettingsSaveCommand = Schema.Struct({
  payload: Schema.Struct({
    settings: Schema.Struct({
      windowPeeking: Schema.Boolean,
    }),
  }),
  type: Schema.Literal("settings:save"),
});

export const WindowControlCommand = Schema.Struct({
  payload: Schema.Union(
    Schema.Literal("minimize"),
    Schema.Literal("maximize"),
    Schema.Literal("close")
  ),
  type: Schema.Literal("window:control"),
});

export const PermissionRespondCommand = Schema.Struct({
  payload: Schema.Struct({
    granted: Schema.Boolean,
    requestId: Schema.String,
  }),
  type: Schema.Literal("permission:respond"),
});

export const IPCCommand = Schema.Union(
  DialogOpenFileCommand,
  StateLoadCommand,
  StateSaveCommand,
  SettingsSaveCommand,
  WindowControlCommand,
  PermissionRespondCommand
);

export type IPCCommand = typeof IPCCommand.Type;

export const IPCResponse = Schema.Union(
  Schema.Struct({ data: Schema.Unknown, success: Schema.Literal(true) }),
  Schema.Struct({
    details: Schema.optional(Schema.Unknown),
    error: Schema.String,
    success: Schema.Literal(false),
  })
);

export type IPCResponse = typeof IPCResponse.Type;
