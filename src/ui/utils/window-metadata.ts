/** Converters between window state and persisted metadata. */

import type {
  PreviewType,
  WindowKind,
  WindowMetadata,
} from "../../shared/contract";
import type { Window as WindowData } from "../store/window-store";

/**
 * Preview windows point at temp files wiped between runs, and generation
 * windows are transient (their finished artifact opens in their place) —
 * persisting either would only restore dead windows.
 */
export const isPersistableWindow = (window: {
  readonly kind?: WindowKind;
  readonly previewType?: PreviewType;
}): boolean => window.previewType === undefined && window.kind !== "generation";

export const windowMetadataFromWindow = (
  window: WindowData
): WindowMetadata => ({
  bounds: { height: window.h, width: window.w, x: window.x, y: window.y },
  id: window.id,
  kind: window.kind,
  previewType: window.previewType,
  title: window.fileName,
  url: window.url,
  zIndex: window.z ?? 1,
});

export const windowFromMetadata = (metadata: WindowMetadata): WindowData => ({
  fileName: metadata.title,
  h: metadata.bounds.height,
  id: metadata.id,
  kind: metadata.kind,
  previewType: metadata.previewType,
  url: metadata.url,
  w: metadata.bounds.width,
  x: metadata.bounds.x,
  y: metadata.bounds.y,
  z: metadata.zIndex,
});
