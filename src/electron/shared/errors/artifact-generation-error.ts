/** Tagged errors for sandboxed artifact generation. */

import * as Data from "effect/Data";

export type ArtifactGenerationErrorReason =
  | "ProviderNotFound"
  | "ProviderUnavailable"
  | "SpawnFailed"
  | "ArtifactMissing"
  | "ArtifactTooLarge"
  | "TerminationFailed"
  | "ShuttingDown";

export class ArtifactGenerationError extends Data.TaggedError(
  "ArtifactGenerationError"
)<{
  readonly reason: ArtifactGenerationErrorReason;
  /** User-facing text; `Data.Error` promotes this to `error.message`. */
  readonly message?: string;
  readonly providerId?: string;
  readonly cause?: unknown;
}> {}
