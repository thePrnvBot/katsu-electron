/** Tests for the generation loading words. */

import { describe, expect, it } from "vitest";

import { LOADING_WORDS, randomLoadingWord } from "./loading-words";

describe("randomLoadingWord", () => {
  it("returns a known word", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(LOADING_WORDS).toContain(randomLoadingWord());
    }
  });

  it("avoids the excluded word when possible", () => {
    const [word] = LOADING_WORDS;
    for (let index = 0; index < 50; index += 1) {
      expect(randomLoadingWord(word)).not.toBe(word);
    }
  });
});
