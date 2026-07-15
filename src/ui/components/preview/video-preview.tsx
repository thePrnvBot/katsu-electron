import { useState } from "react";

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
      <div
        style={{
          alignItems: "center",
          background: "#0f0f0f",
          color: "#999",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          height: "100%",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 32, opacity: 0.4 }}>&#9888;</div>
        <div style={{ color: "#ddd", fontSize: 14 }}>{fileName}</div>
        <div style={{ fontSize: 12 }}>Failed to load video</div>
      </div>
    );
  }

  return (
    <video
      autoPlay
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
      <track kind="captions" label="Captions" src="" />
    </video>
  );
};
