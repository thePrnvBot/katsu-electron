import type { PreviewType } from "../utils/file-preview";
import { AudioPreview } from "./preview/audio-preview";
import { DownloadPreview } from "./preview/download-preview";
import { ImagePreview } from "./preview/image-preview";
import { TextPreview } from "./preview/text-preview";
import { VideoPreview } from "./preview/video-preview";

interface FilePreviewProps {
  fileName: string;
  previewType: PreviewType;
  url: string;
  windowId: string;
}

export const FilePreview = ({
  fileName,
  previewType,
  url,
  windowId,
}: FilePreviewProps) => {
  switch (previewType) {
    case "text": {
      return <TextPreview fileName={fileName} url={url} />;
    }
    case "image": {
      return <ImagePreview fileName={fileName} url={url} windowId={windowId} />;
    }
    case "video": {
      return <VideoPreview fileName={fileName} url={url} windowId={windowId} />;
    }
    case "audio": {
      return <AudioPreview fileName={fileName} url={url} />;
    }
    case "download": {
      return <DownloadPreview fileName={fileName} />;
    }
    default: {
      return <DownloadPreview fileName={fileName} />;
    }
  }
};
