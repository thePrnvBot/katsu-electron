/** Tests for HTTP Range header parsing. */

import { describe, expect, it } from "vitest";

import { parseRangeHeader } from "./byte-range";

describe("parseRangeHeader", () => {
  it("parses a closed range", () => {
    expect(parseRangeHeader("bytes=0-99", 1000)).toEqual({ end: 99, start: 0 });
  });

  it("clamps the end to the file size", () => {
    expect(parseRangeHeader("bytes=900-5000", 1000)).toEqual({
      end: 999,
      start: 900,
    });
  });

  it("parses an open-ended range", () => {
    expect(parseRangeHeader("bytes=200-", 1000)).toEqual({
      end: 999,
      start: 200,
    });
  });

  it("parses a suffix range", () => {
    expect(parseRangeHeader("bytes=-100", 1000)).toEqual({
      end: 999,
      start: 900,
    });
  });

  it("clamps a suffix longer than the file", () => {
    expect(parseRangeHeader("bytes=-5000", 1000)).toEqual({
      end: 999,
      start: 0,
    });
  });

  it("rejects unsatisfiable ranges", () => {
    expect(parseRangeHeader("bytes=1000-", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=300-200", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=-", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=", 1000)).toBeNull();
    expect(parseRangeHeader("items=0-1", 1000)).toBeNull();
  });

  it("rejects non-integer and zero suffix values", () => {
    expect(parseRangeHeader("bytes=abc-", 1000)).toBeNull();
    expect(parseRangeHeader("bytes=-0", 1000)).toBeNull();
  });
});
