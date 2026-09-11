/** Tests for the extension-to-grammar mapping. */

import { describe, expect, it } from "vitest";

import { languageForExtension } from "./syntax-highlighter";

describe("languageForExtension", () => {
  it("maps common code extensions to bundled grammars", () => {
    expect(languageForExtension("ts")).toBe("typescript");
    expect(languageForExtension("tsx")).toBe("tsx");
    expect(languageForExtension("py")).toBe("python");
    expect(languageForExtension("rs")).toBe("rust");
    expect(languageForExtension("sh")).toBe("shellscript");
    expect(languageForExtension("bash")).toBe("shellscript");
    expect(languageForExtension("yml")).toBe("yaml");
    expect(languageForExtension("h")).toBe("c");
  });

  it("returns null for unsupported extensions", () => {
    expect(languageForExtension("txt")).toBeNull();
    expect(languageForExtension("csv")).toBeNull();
    expect(languageForExtension("")).toBeNull();
  });
});
