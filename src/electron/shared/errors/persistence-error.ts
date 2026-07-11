export class PersistenceError extends Error {
  readonly _tag:
    | "ReadFailed"
    | "WriteFailed"
    | "ParseFailed"
    | "AtomicRenameFailed";
  readonly cause?: unknown;

  constructor(tag: PersistenceError["_tag"], cause?: unknown) {
    super(`PersistenceError: ${tag}`);
    this.name = "PersistenceError";
    this._tag = tag;
    this.cause = cause;
  }
}
