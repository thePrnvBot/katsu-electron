/** Markdown file preview body rendered with TanStack Markdown. */

import { Markdown } from "@tanstack/markdown/react";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";

import { readTextPreview } from "../../utils/text-preview-content";
import { PreviewPlaceholder } from "./preview-placeholder";

interface MarkdownPreviewProps {
  fileName: string;
  url: string;
}

type MarkdownAnchorProps = ComponentPropsWithoutRef<"a">;

/**
 * Markdown links open as new windows so the app's window-open handler sends
 * http(s) targets to the system browser instead of navigating the preview.
 */
const MarkdownAnchor = ({ children, ...props }: MarkdownAnchorProps) => (
  <a {...props} rel="noopener noreferrer" target="_blank">
    {children}
  </a>
);

export const MarkdownPreview = ({ fileName, url }: MarkdownPreviewProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const loadMarkdown = async () => {
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

    loadMarkdown();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  if (error) {
    return (
      <PreviewPlaceholder
        icon="⚠️"
        title={fileName}
        subtitle="Failed to load Markdown content"
      />
    );
  }

  if (content === null) {
    return (
      <PreviewPlaceholder
        icon="⏳"
        title={fileName}
        subtitle="Loading Markdown content..."
      />
    );
  }

  return (
    <div
      className="markdown-preview"
      style={{
        background: "#0f0f0f",
        height: "100%",
        overflow: "auto",
        padding: "16px 20px",
      }}
    >
      <Markdown
        allowHtml={false}
        components={{ a: MarkdownAnchor }}
        headingAnchors={false}
      >
        {content}
      </Markdown>
    </div>
  );
};
