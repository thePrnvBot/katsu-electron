import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

/**
 * One-shot read capability for files the user picked in the native open
 * dialog. `fs:stageFile` consumes entries, so a renderer cannot stage
 * arbitrary paths it was never granted.
 */
export interface FileStaging {
  /** Grant (or re-grant) dialog-picked paths. */
  readonly grantPaths: (paths: readonly string[]) => Effect.Effect<void>;
  /** Check a grant without consuming it. */
  readonly hasPath: (filePath: string) => Effect.Effect<boolean>;
  /** Consume a grant — true only when this path was granted and unused. */
  readonly consumePath: (filePath: string) => Effect.Effect<boolean>;
}

export const FileStaging = Context.GenericTag<FileStaging>("FileStaging");

export const FileStagingLive = Layer.sync(FileStaging, () => {
  const stageable = new Set<string>();

  return {
    consumePath: (filePath) => Effect.sync(() => stageable.delete(filePath)),

    grantPaths: (paths) =>
      Effect.sync(() => {
        for (const filePath of paths) {
          stageable.add(filePath);
        }
      }),

    hasPath: (filePath) => Effect.sync(() => stageable.has(filePath)),
  };
});
