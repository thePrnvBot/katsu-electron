/** Converters between window state and persisted metadata. */

import type { WindowMetadata } from "../../shared/contract";
import type { Window as WindowData } from "../store/window-store";

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
