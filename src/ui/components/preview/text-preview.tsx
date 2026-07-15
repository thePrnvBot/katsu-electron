import { useEffect, useState } from "react";

interface TextPreviewProps {
  fileName: string;
  url: string;
}

export const TextPreview = ({ fileName, url }: TextPreviewProps) => {
  const [content, setContent] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadText = async () => {
      try {
        const response = await fetch(url);
        const text = await response.text();
        setContent(text);
      } catch {
        setError(true);
      }
    };

    loadText();
  }, [url]);

  const ext = fileName.split(".").pop() ?? "text";

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
        <div style={{ fontSize: 12 }}>Failed to load file content</div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#0f0f0f",
        color: "#d4d4d4",
        fontFamily: "'Geist Mono', 'Fira Code', monospace",
        fontSize: 13,
        height: "100%",
        lineHeight: 1.6,
        overflow: "auto",
        padding: 16,
      }}
    >
      <div
        style={{
          borderBottom: "1px solid #222",
          color: "#666",
          fontSize: 11,
          marginBottom: 12,
          paddingBottom: 8,
        }}
      >
        {fileName} — {ext}
      </div>
      <pre
        style={{
          tabSize: 2,
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
        }}
      >
        {content || "Loading..."}
      </pre>
    </div>
  );
};
