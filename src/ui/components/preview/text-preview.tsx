/** Text file preview body with optional Shiki syntax highlighting. */

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { ThemedToken } from "shiki/core";

import { highlightCode } from "../../utils/syntax-highlighter";
import { readTextPreview } from "../../utils/text-preview-content";
import { PreviewPlaceholder } from "./preview-placeholder";

interface TextPreviewProps {
  fileName: string;
  url: string;
}

interface KeyedLine {
  readonly key: string;
  readonly tokens: readonly ThemedToken[];
}

/** vscode-textmate FontStyle bit flags, exposed by Shiki tokens. */
const FONT_STYLE_ITALIC = 1;
const FONT_STYLE_BOLD = 2;
const FONT_STYLE_UNDERLINE = 4;
const FONT_STYLE_STRIKETHROUGH = 8;

/** Bit test without bitwise operators (lint bans them). */
const hasFlag = (value: number, flag: number): boolean =>
  Math.trunc(value / flag) % 2 === 1;

const tokenStyle = (token: ThemedToken): CSSProperties => {
  const style: CSSProperties = {};
  if (token.color !== undefined) {
    style.color = token.color;
  }
  const fontStyle = token.fontStyle ?? 0;
  if (hasFlag(fontStyle, FONT_STYLE_ITALIC)) {
    style.fontStyle = "italic";
  }
  if (hasFlag(fontStyle, FONT_STYLE_BOLD)) {
    style.fontWeight = "bold";
  }
  const decorations: string[] = [];
  if (hasFlag(fontStyle, FONT_STYLE_UNDERLINE)) {
    decorations.push("underline");
  }
  if (hasFlag(fontStyle, FONT_STYLE_STRIKETHROUGH)) {
    decorations.push("line-through");
  }
  if (decorations.length > 0) {
    style.textDecoration = decorations.join(" ");
  }
  return style;
};

/** Pair each line with a stable key derived from its character offset. */
const withLineKeys = (
  lines: readonly (readonly ThemedToken[])[]
): KeyedLine[] => {
  const keyed: KeyedLine[] = [];
  let offset = 0;
  for (const tokens of lines) {
    keyed.push({ key: `line-${offset}`, tokens });
    offset += tokens.reduce((sum, token) => sum + token.content.length, 0) + 1;
  }
  return keyed;
};

export const TextPreview = ({ fileName, url }: TextPreviewProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [tokens, setTokens] = useState<
    readonly (readonly ThemedToken[])[] | null
  >(null);

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

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

  // Progressive enhancement: plain text paints first, highlighting swaps in.
  useEffect(() => {
    let cancelled = false;

    const applyHighlight = async () => {
      if (content === null) {
        setTokens(null);
        return;
      }
      const result = await highlightCode(content, extension);
      if (!cancelled) {
        setTokens(result);
      }
    };

    applyHighlight();

    return () => {
      cancelled = true;
    };
  }, [content, extension]);

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
        {fileName} — {extension || "text"}
      </div>
      <pre
        style={{
          tabSize: 2,
          whiteSpace: "pre-wrap",
          wordWrap: "break-word",
        }}
      >
        {tokens
          ? withLineKeys(tokens).map((line) => (
              <div key={line.key} style={{ minHeight: "1.6em" }}>
                {line.tokens.map((token) => (
                  <span key={token.offset} style={tokenStyle(token)}>
                    {token.content}
                  </span>
                ))}
              </div>
            ))
          : content}
      </pre>
    </div>
  );
};
