/** Tests for artifact prompt shaping, invocation, and discovery. */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildAgentEnv,
  buildArtifactArgs,
  buildArtifactInvocation,
  buildArtifactPrompt,
  classifyArtifact,
  collectArtifactFiles,
  extractHtmlTitle,
  pickArtifact,
} from "./artifact-output";

describe("buildArtifactPrompt", () => {
  it("embeds the user request and the workspace contract", () => {
    const prompt = buildArtifactPrompt("a pricing page");
    expect(prompt).toContain("a pricing page");
    expect(prompt).toContain("./index.html");
    expect(prompt).toContain("<title>");
    // The sandboxed iframe has an opaque origin, so storage APIs throw.
    expect(prompt).toContain("localStorage");
  });
});

describe("extractHtmlTitle", () => {
  it("reads and normalizes the agent's title", () => {
    expect(extractHtmlTitle("<title>  Todo  App  </title>")).toBe("Todo App");
  });

  it("decodes basic HTML entities", () => {
    expect(extractHtmlTitle("<title>Tom &amp; Jerry</title>")).toBe(
      "Tom & Jerry"
    );
  });

  it("returns null when there is no usable title", () => {
    expect(extractHtmlTitle("<html><body>hi</body></html>")).toBeNull();
    expect(extractHtmlTitle("<title>   </title>")).toBeNull();
  });

  it("caps very long titles", () => {
    const title = extractHtmlTitle(`<title>${"x".repeat(200)}</title>`);
    expect(title?.length).toBeLessThanOrEqual(60);
    expect(title?.endsWith("…")).toBe(true);
  });
});

describe("buildArtifactArgs", () => {
  it("substitutes only the exact placeholder tokens", () => {
    expect(buildArtifactArgs(["run", "{prompt}"], "hi", "/ws")).toEqual([
      "run",
      "hi",
    ]);
    expect(
      buildArtifactArgs(["run", "--dir", "{dir}", "{prompt}"], "hi", "/ws")
    ).toEqual(["run", "--dir", "/ws", "hi"]);
    expect(buildArtifactArgs(["{prompt}suffix"], "hi", "/ws")).toEqual([
      "{prompt}suffix",
    ]);
  });
});

describe("buildAgentEnv", () => {
  it("re-anchors project-discovery variables to the workspace", () => {
    const env = buildAgentEnv("/ws");
    expect(env.PWD).toBe("/ws");
    expect(env.INIT_CWD).toBe("/ws");
    expect(env.OLDPWD).toBeUndefined();
    for (const key of Object.keys(env)) {
      expect(key.startsWith("npm_")).toBe(false);
    }
  });
});

describe("buildArtifactInvocation", () => {
  it("spawns an executable directly without verbatim args", () => {
    expect(buildArtifactInvocation("opencode", ["run", "hi"])).toEqual({
      args: ["run", "hi"],
      command: "opencode",
      windowsVerbatimArguments: false,
    });
  });
});

describe("pickArtifact", () => {
  it("prefers index.html over other files", () => {
    expect(pickArtifact(["b.html", "index.html", "a.txt"])).toBe("index.html");
  });

  it("falls back to any HTML, then the first file", () => {
    expect(pickArtifact(["notes.txt", "page.html"])).toBe("page.html");
    expect(pickArtifact(["notes.txt"])).toBe("notes.txt");
  });

  it("returns null when nothing was produced", () => {
    expect(pickArtifact([])).toBeNull();
  });
});

describe("classifyArtifact", () => {
  it("maps files to preview surfaces", () => {
    expect(classifyArtifact("index.html")).toBe("html");
    expect(classifyArtifact("page.htm")).toBe("html");
    expect(classifyArtifact("notes.md")).toBe("markdown");
    expect(classifyArtifact("logo.png")).toBe("image");
    expect(classifyArtifact("data.txt")).toBe("text");
  });
});

describe("collectArtifactFiles", () => {
  it("finds artifacts recursively but ignores dependency directories", async () => {
    const root = path.join(
      os.tmpdir(),
      `katsu-artifact-${crypto.randomUUID()}`
    );
    const nested = path.join(root, "assets");
    const ignored = path.join(root, "node_modules");
    try {
      await fs.mkdir(nested, { recursive: true });
      await fs.mkdir(ignored, { recursive: true });
      await fs.writeFile(path.join(root, "index.html"), "<h1>hi</h1>");
      await fs.writeFile(path.join(nested, "page.html"), "<p>page</p>");
      await fs.writeFile(path.join(ignored, "dep.js"), "module.exports = 1");

      const files = await collectArtifactFiles(root, 0);
      const relative = files
        .map((file) => path.relative(root, file).replaceAll("\\", "/"))
        .toSorted((a, b) => a.localeCompare(b));

      expect(relative).toEqual(["assets/page.html", "index.html"]);
      expect(pickArtifact(files)).toBe(path.join(root, "index.html"));
    } finally {
      await fs.rm(root, { force: true, recursive: true });
    }
  });
});
