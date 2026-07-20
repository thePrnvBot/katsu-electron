import * as Data from "effect/Data";

export type ProtocolErrorReason =
  | "FileNotFound"
  | "PermissionDenied"
  | "InvalidPath";

export class ProtocolError extends Data.TaggedError("ProtocolError")<{
  readonly reason: ProtocolErrorReason;
  readonly path?: string;
  readonly cause?: unknown;
}> {}
