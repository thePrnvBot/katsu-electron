import { PreviewPlaceholder } from "./preview-placeholder";

interface DownloadPreviewProps {
  fileName: string;
}

export const DownloadPreview = ({ fileName }: DownloadPreviewProps) => (
  <PreviewPlaceholder
    icon="📦"
    title={fileName}
    subtitle="Preview not available — download to view"
  />
);
