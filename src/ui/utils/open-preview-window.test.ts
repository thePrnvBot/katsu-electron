/** Tests for generation -> artifact window conversion. */

import { describe, expect, it } from "vitest";

import { useWindowStore } from "../store/window-store";
import {
  openGenerationWindow,
  showArtifactInWindow,
} from "./open-preview-window";

describe("generation windows", () => {
  it("opens as a generation window and becomes the artifact in place", () => {
    const windowId = openGenerationWindow("OpenCode");
    const opened = useWindowStore.getState().windows[windowId];

    expect(opened?.kind).toBe("generation");
    expect(opened?.fileName).toBe("OpenCode");
    expect(useWindowStore.getState().activeWindowId).toBe(windowId);

    showArtifactInWindow(
      windowId,
      {
        fileName: "index.html",
        previewType: "html",
        url: "katsu://preview/index.html",
      },
      "Todo App"
    );

    const finished = useWindowStore.getState().windows[windowId];
    // Same window id: the artifact lands where the logs were streaming.
    expect(finished?.id).toBe(windowId);
    expect(finished?.kind).toBeUndefined();
    expect(finished?.previewType).toBe("html");
    expect(finished?.url).toBe("katsu://preview/index.html");
    expect(finished?.fileName).toBe("Todo App");
  });
});
