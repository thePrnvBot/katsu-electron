/** HTML artifact preview: rendered live inside a locked-down iframe. */

interface HtmlPreviewProps {
  fileName: string;
  url: string;
}

/**
 * Generated HTML is untrusted. `allow-scripts` (without `allow-same-origin`)
 * gives the page an opaque origin: its scripts run but cannot reach the host
 * app, its storage, or its session. The `katsu://` response also carries a
 * CSP that blocks network access, so artifacts must be self-contained.
 */
export const HtmlPreview = ({ fileName, url }: HtmlPreviewProps) => (
  <iframe
    sandbox="allow-scripts"
    src={url}
    style={{
      background: "#fff",
      border: "none",
      height: "100%",
      width: "100%",
    }}
    title={fileName || "HTML artifact"}
  />
);
