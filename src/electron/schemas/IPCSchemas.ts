import * as Schema from "effect/Schema";

export const BoundsSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number.pipe(Schema.positive()),
  height: Schema.Number.pipe(Schema.positive()),
});

export const WindowMetadataSchema = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  bounds: BoundsSchema,
  zIndex: Schema.Number.pipe(Schema.int()),
  title: Schema.optional(Schema.String),
});

export const DialogOpenFileCommand = Schema.Struct({
  type: Schema.Literal("dialog:openFile"),
  payload: Schema.Struct({}),
});

export const StateLoadCommand = Schema.Struct({
  type: Schema.Literal("state:load"),
  payload: Schema.Struct({}),
});

export const StateSaveCommand = Schema.Struct({
  type: Schema.Literal("state:save"),
  payload: Schema.Struct({
    windows: Schema.Array(WindowMetadataSchema),
  }),
});

export const WindowControlCommand = Schema.Struct({
  type: Schema.Literal("window:control"),
  payload: Schema.Union(
    Schema.Literal("minimize"),
    Schema.Literal("maximize"),
    Schema.Literal("close")
  ),
});

export const PermissionRespondCommand = Schema.Struct({
  type: Schema.Literal("permission:respond"),
  payload: Schema.Struct({
    requestId: Schema.String,
    granted: Schema.Boolean,
  }),
});

export const IPCCommand = Schema.Union(
  DialogOpenFileCommand,
  StateLoadCommand,
  StateSaveCommand,
  WindowControlCommand,
  PermissionRespondCommand
);

export type IPCCommand = typeof IPCCommand.Type;

export const IPCResponse = Schema.Union(
  Schema.Struct({ success: Schema.Literal(true), data: Schema.Unknown }),
  Schema.Struct({
    success: Schema.Literal(false),
    error: Schema.String,
    details: Schema.optional(Schema.Unknown),
  })
);

export type IPCResponse = typeof IPCResponse.Type;
