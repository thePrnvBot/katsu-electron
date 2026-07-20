import { useEffect, useState } from "react";

import { PreviewPlaceholder } from "./preview-placeholder";

interface TextPreviewProps {
  fileName: string;
  url: string;
}

export const TextPreview = ({ fileName, url }: TextPreviewProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadText = async () => {
      setError(false);
      setContent(null);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        if (!cancelled) {
          setContent(text);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    };

    loadText();

    return () => {
      cancelled = true;
    };
  }, [url]);

  const ext = fileName.split(".").pop() ?? "text";

  if (error) {
    return (
      <PreviewPlaceholder
        icon="⚠️"
        title={fileName}
        subtitle="Failed to load file content"
      />
    );
  }

  if (content === null) {
    return (
      <PreviewPlaceholder
        icon="⏳"
        title={fileName}
        subtitle="Loading file content..."
      />
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
        {content}
      </pre>
    </div>
  );
};
