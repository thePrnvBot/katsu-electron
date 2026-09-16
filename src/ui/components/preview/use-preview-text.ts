/** Shared fetch hook for text-like previews (plain text, Markdown). */

import { useEffect, useState } from "react";

import { readTextPreview } from "../../utils/text-preview-content";

interface PreviewTextState {
  content: string | null;
  error: boolean;
}

/**
 * Fetches a preview URL as size-capped text. Loading starts null, failures
 * set `error`; the request aborts when the URL changes or the view unmounts.
 */
export const usePreviewText = (url: string): PreviewTextState => {
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

    void loadText();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [url]);

  return { content, error };
};
