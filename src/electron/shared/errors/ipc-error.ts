export class IPCError extends Error {
  readonly _tag:
    | "InvalidCommand"
    | "SchemaValidationFailed"
    | "ServiceNotFound"
    | "CommandFailed";
  readonly command?: string;
  readonly cause?: unknown;

  constructor(tag: IPCError["_tag"], command?: string, cause?: unknown) {
    super(`IPCError: ${tag}`);
    this.name = "IPCError";
    this._tag = tag;
    this.command = command;
    this.cause = cause;
  }
}
