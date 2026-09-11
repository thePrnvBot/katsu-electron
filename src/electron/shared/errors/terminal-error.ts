/** Tagged errors for PTY terminal operations. */

import * as Data from "effect/Data";

export type TerminalErrorReason =
  | "SpawnFailed"
  | "UnknownTerminal"
  | "WriteFailed"
  | "ResizeFailed";

export class TerminalError extends Data.TaggedError("TerminalError")<{
  readonly reason: TerminalErrorReason;
  readonly terminalId?: string;
  readonly cause?: unknown;
}> {}
