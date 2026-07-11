export class ProtocolError extends Error {
  readonly _tag:
    | "FileNotFound"
    | "PermissionDenied"
    | "InvalidPath"
    | "MimeDetectionFailed"
    | "CacheError";
  readonly path?: string;
  readonly cause?: unknown;

  constructor(tag: ProtocolError["_tag"], path?: string, cause?: unknown) {
    super(`ProtocolError: ${tag}`);
    this.name = "ProtocolError";
    this._tag = tag;
    this.path = path;
    this.cause = cause;
  }
}
