import * as Data from "effect/Data";

export type PersistenceErrorReason =
  | "ReadFailed"
  | "WriteFailed"
  | "ParseFailed"
  | "AtomicRenameFailed";

export class PersistenceError extends Data.TaggedError("PersistenceError")<{
  readonly reason: PersistenceErrorReason;
  readonly cause?: unknown;
}> {}
