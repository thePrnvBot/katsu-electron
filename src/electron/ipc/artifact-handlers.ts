/** IPC handlers for local sandboxed artifact generation. */

import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { ipcMain } from "electron";

import type {
  ArtifactCancelResponse,
  ArtifactProviderId,
} from "../../shared/contract.js";
import { IpcChannel } from "../../shared/ipc-channels.js";
import { mainRuntime } from "../runtime.js";
import { ArtifactStartPayloadSchema } from "../schemas/ipc-schemas.js";
import { ArtifactGenerationService } from "../services/artifact-generation.js";
import { listProviders } from "../services/artifact-providers.js";
import { assertMainWindowSender, decodePayload } from "./guards.js";

export const registerArtifactHandlers = (): void => {
  // Start a generation; the outcome arrives on IpcChannel.artifactProgress.
  ipcMain.handle(
    IpcChannel.artifactGenerate,
    async (
      event,
      payload: { prompt: string; providerId: ArtifactProviderId }
    ) => {
      assertMainWindowSender(event);
      return await mainRuntime.runPromise(
        Effect.gen(function* startGeneration() {
          const parsed = yield* decodePayload(
            ArtifactStartPayloadSchema,
            payload,
            "invalid artifact generation payload"
          );
          const generation = yield* ArtifactGenerationService;
          return yield* generation.start(parsed);
        }).pipe(
          Effect.match({
            onFailure: (error) => ({
              error: error.message ?? "Generation could not start.",
              success: false as const,
            }),
            onSuccess: (data) => ({ data, success: true as const }),
          })
        )
      );
    }
  );

  // Cancel a running generation (its workspace is removed).
  ipcMain.handle(
    IpcChannel.artifactCancel,
    async (event, id: string): Promise<ArtifactCancelResponse> => {
      assertMainWindowSender(event);
      return await mainRuntime.runPromise(
        Effect.gen(function* cancelGeneration() {
          const parsed = yield* decodePayload(
            Schema.String,
            id,
            "invalid generation id"
          );
          const generation = yield* ArtifactGenerationService;
          yield* generation.cancel(parsed);
        }).pipe(
          Effect.match({
            onFailure: (error) => ({
              error: error.message ?? "Generation could not be cancelled.",
              success: false as const,
            }),
            onSuccess: () => ({ success: true as const }),
          })
        )
      );
    }
  );

  // List local providers so the UI can mark which are installed.
  ipcMain.handle(IpcChannel.artifactProviders, (event) => {
    assertMainWindowSender(event);
    return listProviders();
  });
};
