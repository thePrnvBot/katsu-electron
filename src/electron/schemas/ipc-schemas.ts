import * as Schema from "effect/Schema";

import type {
  Bounds,
  IPCCommand,
  PermissionRespondCommand,
  PreviewType,
  Settings,
  SettingsSaveCommand,
  TerminalResizePayload,
  TerminalSpawnOptions,
  TerminalWritePayload,
  WindowControlCommand,
  WindowKind,
  WindowMetadata,
} from "../../shared/contract.js";

/**
 * Runtime validation for the IPC boundary.
 *
 * Each schema is annotated with its contract type from
 * `src/shared/contract.ts`, so drift between the two fails to compile.
 */

const BoundsSchema: Schema.Schema<Bounds> = Schema.Struct({
  height: Schema.Number.pipe(Schema.positive()),
  width: Schema.Number.pipe(Schema.positive()),
  x: Schema.Number,
  y: Schema.Number,
});

const PreviewTypeSchema: Schema.Schema<PreviewType> = Schema.Literal(
  "text",
  "image",
  "video",
  "audio",
  "pdf",
  "download"
);

const WindowKindSchema: Schema.Schema<WindowKind> = Schema.Literal(
  "webview",
  "terminal"
);

const WindowMetadataSchema: Schema.Schema<WindowMetadata> = Schema.Struct({
  bounds: BoundsSchema,
  id: Schema.String,
  kind: Schema.optional(WindowKindSchema),
  previewType: Schema.optional(PreviewTypeSchema),
  title: Schema.optional(Schema.String),
  url: Schema.String,
  zIndex: Schema.Number.pipe(Schema.int()),
});

export const WindowsSchema = Schema.Array(WindowMetadataSchema);

export const SettingsSchema: Schema.Schema<Settings> = Schema.Struct({
  keepWindowsAlive: Schema.Boolean,
  windowPeeking: Schema.Boolean,
});

const WindowControlCommandSchema: Schema.Schema<WindowControlCommand> =
  Schema.Struct({
    payload: Schema.Union(
      Schema.Literal("minimize"),
      Schema.Literal("maximize"),
      Schema.Literal("close")
    ),
    type: Schema.Literal("window:control"),
  });

const SettingsSaveCommandSchema: Schema.Schema<SettingsSaveCommand> =
  Schema.Struct({
    payload: Schema.Struct({
      settings: SettingsSchema,
    }),
    type: Schema.Literal("settings:save"),
  });

const PermissionRespondCommandSchema: Schema.Schema<PermissionRespondCommand> =
  Schema.Struct({
    payload: Schema.Struct({
      granted: Schema.Boolean,
      requestId: Schema.String,
    }),
    type: Schema.Literal("permission:respond"),
  });

export const IPCCommandSchema: Schema.Schema<IPCCommand> = Schema.Union(
  WindowControlCommandSchema,
  SettingsSaveCommandSchema,
  PermissionRespondCommandSchema
);

// --- Terminal (PTY) IPC payloads ---

const MAX_TERMINAL_DIMENSION = 1000;

export const TerminalSpawnOptionsSchema: Schema.Schema<TerminalSpawnOptions> =
  Schema.Struct({
    cols: Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.lessThanOrEqualTo(MAX_TERMINAL_DIMENSION)
    ),
    cwd: Schema.optional(Schema.String),
    rows: Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.lessThanOrEqualTo(MAX_TERMINAL_DIMENSION)
    ),
  });

export const TerminalWritePayloadSchema: Schema.Schema<TerminalWritePayload> =
  Schema.Struct({
    data: Schema.String,
    id: Schema.String,
  });

export const TerminalResizePayloadSchema: Schema.Schema<TerminalResizePayload> =
  Schema.Struct({
    cols: Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.lessThanOrEqualTo(MAX_TERMINAL_DIMENSION)
    ),
    id: Schema.String,
    rows: Schema.Number.pipe(
      Schema.int(),
      Schema.positive(),
      Schema.lessThanOrEqualTo(MAX_TERMINAL_DIMENSION)
    ),
  });

export const TerminalIdSchema = Schema.String;
