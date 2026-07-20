import * as Data from "effect/Data";

export type IPCErrorReason =
  | "InvalidCommand"
  | "SchemaValidationFailed"
  | "CommandFailed";

export class IPCError extends Data.TaggedError("IPCError")<{
  readonly reason: IPCErrorReason;
  readonly command?: string;
  readonly cause?: unknown;
}> {}
