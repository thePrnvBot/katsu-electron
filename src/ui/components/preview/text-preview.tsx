/** Text file preview body with a streaming size cap. */

import { useEffect, useState } from "react";

import { PreviewPlaceholder } from "./preview-placeholder";

const MAX_TEXT_PREVIEW_BYTES = 16 * 1024 * 1024;

interface TextPreviewProps {
  fileName: string;
  url: string;
}

const readTextStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  decoder: TextDecoder,
  chunks: string[],
  bytesRead: number
): Promise<string> => {
  const result = await reader.read();
  if (result.done) {
    chunks.push(decoder.decode());
    return chunks.join("");
  }

  const nextBytesRead = bytesRead + result.value.byteLength;
  if (nextBytesRead > MAX_TEXT_PREVIEW_BYTES) {
    await reader.cancel();
    throw new Error("Text preview exceeds maximum size");
  }
  chunks.push(decoder.decode(result.value, { stream: true }));
  return readTextStream(reader, decoder, chunks, nextBytesRead);
};

const readTextPreview = async (response: Response): Promise<string> => {
  const contentLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_TEXT_PREVIEW_BYTES
  ) {
    throw new Error("Text preview exceeds maximum size");
  }

  if (!response.body) {
    const text = await response.text();
    if (text.length > MAX_TEXT_PREVIEW_BYTES) {
      throw new Error("Text preview exceeds maximum size");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  try {
    return await readTextStream(reader, decoder, chunks, 0);
  } finally {
    reader.releaseLock();
  }
};

export const TextPreview = ({ fileName, url }: TextPreviewProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadText = async () => {
      setError(false);
      setContent(null);

      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const text = await readTextPreview(response);
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
      controller.abort();
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
