/** HTTP Range header parsing for the katsu:// file protocol. */

export interface ByteRange {
  readonly start: number;
  readonly end: number;
}

/** Parses a single `bytes=` range; returns null when unsatisfiable. */
export const parseRangeHeader = (
  header: string,
  size: number
): ByteRange | null => {
  const match = /^bytes=(?<start>\d*)-(?<end>\d*)$/u.exec(header.trim());
  if (!match?.groups) {
    return null;
  }
  const rawStart = match.groups.start;
  const rawEnd = match.groups.end;
  if (!rawStart && !rawEnd) {
    return null;
  }
  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    return { end: size - 1, start: Math.max(0, size - suffixLength) };
  }
  const start = Number(rawStart);
  if (!Number.isInteger(start) || start < 0 || start >= size) {
    return null;
  }
  const end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  if (!Number.isInteger(end) || end < start) {
    return null;
  }
  return { end, start };
};
