import { useState } from "react";

import { PreviewPlaceholder } from "./preview-placeholder";
import { useMediaResize } from "./use-media-resize";

interface ImagePreviewProps {
  fileName: string;
  url: string;
  windowId: string;
}

export const ImagePreview = ({
  fileName,
  url,
  windowId,
}: ImagePreviewProps) => {
  const resizeMedia = useMediaResize(windowId);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <PreviewPlaceholder
        icon="⚠️"
        title={fileName}
        subtitle="Failed to load image"
      />
    );
  }

  return (
    <img
      alt={fileName}
      onError={() => setError(true)}
      onLoad={(e) =>
        resizeMedia(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)
      }
      src={url}
      style={{
        background: "#0f0f0f",
        display: "block",
        height: "100%",
        objectFit: "contain",
        width: "100%",
      }}
    />
  );
};
