import { useState } from "react";

import { PreviewPlaceholder } from "./preview-placeholder";
import { useMediaResize } from "./use-media-resize";

interface VideoPreviewProps {
  fileName: string;
  url: string;
  windowId: string;
}

export const VideoPreview = ({
  fileName,
  url,
  windowId,
}: VideoPreviewProps) => {
  const resizeMedia = useMediaResize(windowId);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <PreviewPlaceholder
        icon="⚠️"
        title={fileName}
        subtitle="Failed to load video"
      />
    );
  }

  return (
    <video
      controls
      onError={() => setError(true)}
      onLoadedMetadata={(e) =>
        resizeMedia(e.currentTarget.videoWidth, e.currentTarget.videoHeight)
      }
      src={url}
      style={{
        background: "#0f0f0f",
        display: "block",
        height: "100%",
        objectFit: "contain",
        width: "100%",
      }}
    >
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- user-provided media has no caption track */}
      <track kind="captions" label="Captions" />
    </video>
  );
};
