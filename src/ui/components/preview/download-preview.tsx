interface DownloadPreviewProps {
  fileName: string;
}

export const DownloadPreview = ({ fileName }: DownloadPreviewProps) => (
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
    <div style={{ fontSize: 32, opacity: 0.4 }}>&#128230;</div>
    <div style={{ color: "#ddd", fontSize: 14 }}>{fileName}</div>
    <div style={{ fontSize: 12 }}>Preview not available — download to view</div>
  </div>
);
