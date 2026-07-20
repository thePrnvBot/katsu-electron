interface AudioPreviewProps {
  fileName: string;
  url: string;
}

export const AudioPreview = ({ fileName, url }: AudioPreviewProps) => (
  <div
    style={{
      alignItems: "center",
      background: "#0f0f0f",
      color: "#999",
      display: "flex",
      flexDirection: "column",
      gap: 16,
      height: "100%",
      justifyContent: "center",
    }}
  >
    <div style={{ color: "#ddd", fontSize: 14 }}>{fileName}</div>
    <audio controls src={url} style={{ width: "80%" }}>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- user-provided media has no caption track */}
      <track kind="captions" label="Captions" />
    </audio>
  </div>
);
