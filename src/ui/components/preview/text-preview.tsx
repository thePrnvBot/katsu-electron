/** Text file preview body with optional Shiki syntax highlighting. */

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { ThemedToken } from "shiki/core";

import { highlightCode } from "../../utils/syntax-highlighter";
import { PreviewPlaceholder } from "./preview-placeholder";
import { usePreviewText } from "./use-preview-text";

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

/**
 * DOM budget: a 16 MB file would otherwise become hundreds of thousands of
 * token spans (or one giant text node). Render at most this many lines /
 * characters and truncate with a notice.
 */
const MAX_RENDERED_LINES = 4000;
const MAX_RENDERED_CHARS = 500_000;

export const TextPreview = ({ fileName, url }: TextPreviewProps) => {
  const { content, error } = usePreviewText(url);
  const [tokens, setTokens] = useState<
    readonly (readonly ThemedToken[])[]
  | null
  >(null);

  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";

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

    void applyHighlight();

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

  const truncated =
    tokens === null
      ? content.length > MAX_RENDERED_CHARS
      : tokens.length > MAX_RENDERED_LINES;
  const shownTokens =
    tokens === null ? null : withLineKeys(tokens).slice(0, MAX_RENDERED_LINES);
  const shownContent =
    tokens === null && truncated
      ? `${content.slice(0, MAX_RENDERED_CHARS)}…`
      : content;

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
        {shownTokens
          ? shownTokens.map((line) => (
              <div key={line.key} style={{ minHeight: "1.6em" }}>
                {line.tokens.map((token) => (
                  <span key={token.offset} style={tokenStyle(token)}>
                    {token.content}
                  </span>
                ))}
              </div>
            ))
          : shownContent}
      </pre>
      {truncated && (
        <div style={{ color: "#666", fontSize: 11, marginTop: 8 }}>
          Preview truncated — first {MAX_RENDERED_LINES} lines shown.
        </div>
      )}
    </div>
  );
};
